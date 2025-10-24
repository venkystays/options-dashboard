package main

import (
	"encoding/json"
	"fmt"
	"log"
	"math"
	"net/http"
	"sort"
	"os"
	"strings"
	"time"

	yahoofinanceapi "github.com/oscarli916/yahoo-finance-api"
	"github.com/ggoodwin/stocks-go"
)

// Consolidated Response for Frontend
type OptionsData struct {
	CompanyName         string `json:"companyName"`
	CurrentPrice        string `json:"currentPrice"`
	RSI                 string `json:"rsi"`
	PutCallRatio        string `json:"putCallRatio"`
	ImpliedVolatility   string `json:"impliedVolatility"`
	RealizedVolatility  string `json:"realizedVolatility"`
	HistoricVolatility  string `json:"historicVolatility"`
	ExpirationDates     []string `json:"expirationDates"`
}

func main() {
	// Get the current working directory
	dir, err := os.Getwd()
	if err != nil {
		log.Fatal(err)
	}
	fmt.Println("Current working directory:", dir)

	// Serve static files from the current directory
	fs := http.FileServer(http.Dir("."))
	http.Handle("/", fs)

	// Handle API requests
	http.HandleFunc("/api/options/", enableCORS(optionsHandler))

	fmt.Println("Server listening on port 8080...")
	log.Fatal(http.ListenAndServe(":8081", nil))
}

func enableCORS(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*") // Allow all origins for development
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	}
}

func calculateRSI(prices []float64, period int) float64 {
	if len(prices) < period+1 {
		return 0.0 // Not enough data to calculate RSI
	}

	var gains []float64
	var losses []float64

	for i := 1; i < len(prices); i++ {
		diff := prices[i] - prices[i-1]
		if diff > 0 {
			gains = append(gains, diff)
			losses = append(losses, 0.0)
		} else {
			gains = append(gains, 0.0)
			losses = append(losses, -diff)
		}
	}

	avgGain := 0.0
	avgLoss := 0.0

	// Initial average gain/loss
	for i := 0; i < period; i++ {
		avgGain += gains[i]
		avgLoss += losses[i]
	}
	avgGain /= float64(period)
	avgLoss /= float64(period)

	// Smoothed average gain/loss
	for i := period; i < len(gains); i++ {
		avgGain = (avgGain*float64(period-1) + gains[i]) / float64(period)
		avgLoss = (avgLoss*float64(period-1) + losses[i]) / float64(period)
	}

	if avgLoss == 0 {
		return 100.0 // Avoid division by zero, indicates strong upward trend
	}

	rsVal := avgGain / avgLoss
	rsi := 100 - (100 / (1 + rsVal))
	return rsi
}

// calculateVolatility calculates annualized historical volatility
func calculateVolatility(prices []float64, period int) float64 {
	if len(prices) < period+1 {
		return 0.0
	}

	logReturns := make([]float64, len(prices)-1)
	for i := 1; i < len(prices); i++ {
		logReturns[i-1] = math.Log(prices[i] / prices[i-1])
	}

	// Take the last 'period' log returns for calculation
	relevantReturns := logReturns[len(logReturns)-period:]

	// Calculate mean of log returns
	sum := 0.0
	for _, r := range relevantReturns {
		sum += r
	}
	mean := sum / float64(period)

	// Calculate standard deviation
	sumSqDiff := 0.0
	for _, r := range relevantReturns {
		sumSqDiff += math.Pow(r-mean, 2)
	}
	stdDev := math.Sqrt(sumSqDiff / float64(period-1)) // Sample standard deviation

	// Annualize (assuming 252 trading days)
	annualizedVolatility := stdDev * math.Sqrt(252)
	return annualizedVolatility
}

func optionsHandler(w http.ResponseWriter, r *http.Request) {
	// Ensure that requests for static files don't get handled by optionsHandler
	if strings.HasSuffix(r.URL.Path, ".html") || strings.HasSuffix(r.URL.Path, ".css") || strings.HasSuffix(r.URL.Path, ".js") {
		http.NotFound(w, r)
		return
	}

	ticker := strings.TrimPrefix(r.URL.Path, "/api/options/")
	if ticker == "" {
		http.Error(w, "Ticker symbol is required", http.StatusBadRequest)
		return
	}

	fmt.Printf("Received request for ticker: %s\n", ticker)

	var consolidatedData OptionsData

	// Fetch company name using ggoodwin/stocks-go
	stockDetails := stocks.GetFullDetails(ticker)
	if stockDetails != nil && stockDetails.ShortName != "" {
		consolidatedData.CompanyName = stockDetails.ShortName
	} else {
		consolidatedData.CompanyName = ticker // Default to ticker if name not found
	}

	// Create a new Ticker instance for yahoo-finance-api
	yfTicker := yahoofinanceapi.NewTicker(ticker)

	// Fetch quote data for current price
	// The yahoofinanceapi.PriceData struct does not contain LongName or RegularMarketPrice.
	// We will use the latest close price from historical data as current price.
	consolidatedData.CurrentPrice = "N/A" // Will be updated from historical data if available

	// Fetch historical data for RSI and Volatility calculations
	historicalData, err := yfTicker.History(yahoofinanceapi.HistoryQuery{Interval: "1d", Range: "1y"}) // 1 day interval, 1 year period
	if err != nil {
		log.Printf("Error fetching historical data for %s: %v", ticker, err)
		consolidatedData.RSI = "Error"
		consolidatedData.RealizedVolatility = "Error"
		consolidatedData.HistoricVolatility = "Error"
	} else {
		var closingPrices []float64
		// Let's collect prices in a slice and then sort them by date
		type PriceEntry struct {
			Date time.Time
			Close float64
		}
		var priceEntries []PriceEntry
		for dateStr, data := range historicalData {
			date, _ := time.Parse("2006-01-02", dateStr)
			priceEntries = append(priceEntries, PriceEntry{Date: date, Close: data.Close})
		}
		sort.Slice(priceEntries, func(i, j int) bool { return priceEntries[i].Date.Before(priceEntries[j].Date) })

		for _, entry := range priceEntries {
			closingPrices = append(closingPrices, entry.Close)
		}

		if len(closingPrices) > 0 {
			consolidatedData.CurrentPrice = fmt.Sprintf("%.2f", closingPrices[len(closingPrices)-1]) // Latest close price
			rsi := calculateRSI(closingPrices, 14) // 14-day RSI
			consolidatedData.RSI = fmt.Sprintf("%.2f", rsi)

			// Realized Volatility (Past Week - 5 trading days)
			if len(closingPrices) >= 6 { // Need at least 6 prices for 5 returns
				realizedVol := calculateVolatility(closingPrices, 5)
				consolidatedData.RealizedVolatility = fmt.Sprintf("%.2f%%", realizedVol*100)
			} else {
				consolidatedData.RealizedVolatility = "N/A (not enough data)"
			}

			// Historic Volatility (e.g., 30 trading days)
			if len(closingPrices) >= 31 { // Need at least 31 prices for 30 returns
				historicVol := calculateVolatility(closingPrices, 30)
				consolidatedData.HistoricVolatility = fmt.Sprintf("%.2f%%", historicVol*100)
			} else {
				consolidatedData.HistoricVolatility = "N/A (not enough data)"
			}

		} else {
			consolidatedData.RSI = "N/A"
			consolidatedData.RealizedVolatility = "N/A"
			consolidatedData.HistoricVolatility = "N/A"
		}
	}

	// Fetch options chain data
	allExpirationDates := yfTicker.ExpirationDates()
	if len(allExpirationDates) == 0 {
		log.Printf("No expiration dates found for ticker: %s", ticker)
	} else {
		log.Printf("Found %d expiration dates for ticker: %s", len(allExpirationDates), ticker)
		consolidatedData.ExpirationDates = allExpirationDates
	}

	// Check for a specific expiration date from query parameter
	selectedExpirationDate := r.URL.Query().Get("expirationDate")

	var optionDataToUse *yahoofinanceapi.OptionData
	var expiryDateToUse time.Time

	if selectedExpirationDate != "" {
		// Use the selected expiration date
		expTime, err := time.Parse("2006-01-02", selectedExpirationDate)
		if err != nil {
			log.Printf("Error parsing selected expiration date %s: %v", selectedExpirationDate, err)
			// Fallback to nearest expiry if selected date is invalid
			selectedExpirationDate = ""
		} else {
			tempOptionData := yfTicker.OptionChainByExpiration(selectedExpirationDate)
			optionDataToUse = &tempOptionData
			expiryDateToUse = expTime
			log.Printf("Using selected expiration date %s for ticker %s", selectedExpirationDate, ticker)
		}
	}

	if selectedExpirationDate == "" {
		// Find the nearest Friday expiration date first
		now := time.Now()
		var nearestFridayExpiry time.Time
		var nearestFridayExpiryStr string

		for _, expDateStr := range allExpirationDates {
			expiryTime, err := time.Parse("2006-01-02", expDateStr)
			if err != nil {
				log.Printf("Error parsing expiration date %s: %v", expDateStr, err)
				continue
			}

			// Consider only future expirations that are Fridays
			if expiryTime.After(now) && expiryTime.Weekday() == time.Friday {
				if nearestFridayExpiry.IsZero() || expiryTime.Before(nearestFridayExpiry) {
					nearestFridayExpiry = expiryTime
					nearestFridayExpiryStr = expDateStr
				}
			}
		}

		if !nearestFridayExpiry.IsZero() {
			// Use the nearest Friday expiry
			tempOptionData := yfTicker.OptionChainByExpiration(nearestFridayExpiryStr)
			optionDataToUse = &tempOptionData
			expiryDateToUse = nearestFridayExpiry
			log.Printf("Using nearest Friday expiration date %s for ticker %s", nearestFridayExpiryStr, ticker)
		} else {
			// Fallback to finding the overall nearest future expiration date if no Friday expiry is found
			var nearestExpiry time.Time
			for _, expDateStr := range allExpirationDates {
				expiryTime, err := time.Parse("2006-01-02", expDateStr)
				if err != nil {
					log.Printf("Error parsing expiration date %s: %v", expDateStr, err)
					continue
				}

				// Consider only future expirations
				if expiryTime.After(now) {
					if optionDataToUse == nil || expiryTime.Before(nearestExpiry) {
						nearestExpiry = expiryTime
						tempOptionData := yfTicker.OptionChainByExpiration(expDateStr)
						optionDataToUse = &tempOptionData
						expiryDateToUse = expiryTime
					}
				}
			}
			if optionDataToUse != nil {
				log.Printf("Using nearest expiration date %s for ticker %s", expiryDateToUse.Format("2006-01-02"), ticker)
			}
		}
	}

	// Calculate Put/Call Ratio for the current week (or selected expiry)
	if optionDataToUse != nil {
		var putsOI int64
		var callsOI int64

		for _, call := range optionDataToUse.Calls {
			callsOI += call.OpenInterest
		}
		for _, put := range optionDataToUse.Puts {
			putsOI += put.OpenInterest
		}
		log.Printf("For ticker %s, expiry %s, Calls OI: %d, Puts OI: %d", ticker, expiryDateToUse.Format("2006-01-02"), callsOI, putsOI)

		if callsOI > 0 {
			putCallRatio := float64(putsOI) / float64(callsOI)
			consolidatedData.PutCallRatio = fmt.Sprintf("%.2f", putCallRatio)
		} else {
			consolidatedData.PutCallRatio = "N/A (no call open interest for selected expiry)"
		}

		// Set Implied Volatility for the current week (or selected expiry)
		if len(optionDataToUse.Calls) > 0 {
			if optionDataToUse.Calls[0].ImpliedVolatility != 0 {
				consolidatedData.ImpliedVolatility = fmt.Sprintf("%.2f%%", optionDataToUse.Calls[0].ImpliedVolatility*100)
			} else {
				consolidatedData.ImpliedVolatility = "N/A"
			}
		} else {
			consolidatedData.ImpliedVolatility = "N/A"
		}

	} else {
		consolidatedData.PutCallRatio = "N/A (no options data for selected/nearest expiry)"
		consolidatedData.ImpliedVolatility = "N/A (no options data for selected/nearest expiry)"
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(consolidatedData)
}