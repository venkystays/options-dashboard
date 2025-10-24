document.addEventListener('DOMContentLoaded', () => {
    const stockNameDisplay = document.getElementById('stockName');
    const currentPriceDisplay = document.getElementById('currentPrice');
    const rsiValueText = document.getElementById('rsiValueText');
    const pcrValue = document.getElementById('pcrValue');
    const ivValue = document.getElementById('ivValue');
    const rvValue = document.getElementById('rvValue');
    const hvValue = document.getElementById('hvValue');
    const tickerInput = document.getElementById('tickerInput');
    const fetchButton = document.getElementById('fetchButton');
    const themeSwitch = document.getElementById('theme-switch');
    const loadingOverlay = document.getElementById('loadingOverlay');
    const expirationDateDropdown = document.getElementById('expirationDateDropdown');
    const strikePriceDropdown = document.getElementById('strikePriceDropdown');
    const strikePriceSelection = document.getElementById('strikePriceSelection');
    const rsiStatus = document.getElementById('rsiStatus');
    const rsiChartCanvas = document.getElementById('rsiChart').getContext('2d');
    let rsiChart;

    let currentTicker = 'AAPL'; // Default ticker

    const showLoading = (isLoading) => {
        if (isLoading) {
            loadingOverlay.classList.add('show');
        } else {
            loadingOverlay.classList.remove('show');
        }
    };

    const populateExpirationDates = (dates, selectedDate = null) => {
        expirationDateDropdown.innerHTML = ''; // Clear previous options
        if (dates && dates.length > 0) {
            dates.forEach(date => {
                const option = document.createElement('option');
                option.value = date;
                option.textContent = date;
                expirationDateDropdown.appendChild(option);
            });
            // Select the provided date or the first one
            if (selectedDate && dates.includes(selectedDate)) {
                expirationDateDropdown.value = selectedDate;
            } else {
                expirationDateDropdown.value = dates[0];
            }
            expirationDateDropdown.style.display = 'block';
        } else {
            const option = document.createElement('option');
            option.value = '';
            option.textContent = 'No expiration dates available';
            expirationDateDropdown.appendChild(option);
            expirationDateDropdown.style.display = 'none';
        }
    };

    const populateStrikePrices = (strikePrices) => {
        strikePriceDropdown.innerHTML = '';
        if (strikePrices && strikePrices.length > 0) {
            strikePrices.forEach(price => {
                const option = document.createElement('option');
                option.value = price;
                option.textContent = price;
                strikePriceDropdown.appendChild(option);
            });
            strikePriceSelection.style.display = 'block';
        } else {
            strikePriceSelection.style.display = 'none';
        }
    };

    const fetchData = async (ticker, expirationDate = null, strikePrice = null) => {
        showLoading(true);
        currentTicker = ticker; // Update current ticker

        let url = `http://localhost:8081/api/options/${ticker}`;
        const params = new URLSearchParams();
        if (expirationDate) {
            params.append('expirationDate', expirationDate);
        }
        if (strikePrice) {
            params.append('strikePrice', strikePrice);
        }
        if (params.toString()) {
            url += `?${params.toString()}`;
        }

        try {
            const response = await fetch(url);
            const data = await response.json();

            if (response.ok) {
                stockNameDisplay.textContent = data.companyName || 'N/A';
                currentPriceDisplay.textContent = data.currentPrice ? `${data.currentPrice}` : 'N/A';
                rsiValueText.textContent = data.rsi || 'N/A';
                if (data.rsi) {
                    const rsiVal = parseFloat(data.rsi);
                    if (rsiVal > 70) {
                        rsiStatus.textContent = 'Overbought';
                        rsiStatus.className = 'status-overbought';
                    } else if (rsiVal < 30) {
                        rsiStatus.textContent = 'Oversold';
                        rsiStatus.className = 'status-oversold';
                    } else {
                        rsiStatus.textContent = 'Neutral';
                        rsiStatus.className = 'status-neutral';
                    }
                } else {
                    rsiStatus.textContent = '';
                }
                pcrValue.textContent = data.putCallRatio || 'N/A';
                ivValue.textContent = data.impliedVolatility || 'N/A';
                rvValue.textContent = data.realizedVolatility || 'N/A';
                hvValue.textContent = data.historicVolatility || 'N/A';

                if (!expirationDate && !strikePrice) {
                    populateExpirationDates(data.expirationDates);
                    if (data.expirationDates && data.expirationDates.length > 0) {
                        fetchStrikePrices(ticker, data.expirationDates[0]);
                    }
                    fetchWeeklyRsi(ticker);
                } else if (expirationDate && !strikePrice) {
                    fetchStrikePrices(ticker, expirationDate);
                }

            } else {
                throw new Error(data.error || 'Unknown error from backend');
            }

        } catch (error) {
            console.error('Error fetching data from Go backend:', error);
            stockNameDisplay.textContent = 'Failed to fetch data. Please try again.';
            currentPriceDisplay.textContent = 'N/A';
            rsiValueText.textContent = 'N/A';
            rsiStatus.textContent = '';
            pcrValue.textContent = 'N/A';
            ivValue.textContent = 'N/A';
            rvValue.textContent = 'N/A';
            hvValue.textContent = 'N/A';
            populateExpirationDates([]);
            populateStrikePrices([]);
        } finally {
            showLoading(false);
        }
    };

    const fetchStrikePrices = async (ticker, expirationDate) => {
        try {
            const response = await fetch(`http://localhost:8081/api/strikes/${ticker}?expirationDate=${expirationDate}`);
            const data = await response.json();
            if (response.ok) {
                populateStrikePrices(data.strikePrices);
            } else {
                throw new Error(data.error || 'Failed to fetch strike prices');
            }
        } catch (error) {
            console.error('Error fetching strike prices:', error);
            populateStrikePrices([]);
        }
    };

    const fetchWeeklyRsi = async (ticker) => {
        try {
            const response = await fetch(`http://localhost:8081/api/rsi/weekly/${ticker}`);
            const data = await response.json();
            if (response.ok) {
                updateRsiChart(data.timestamps, data.rsiValues);
            } else {
                throw new Error(data.error || 'Failed to fetch weekly RSI data');
            }
        } catch (error) {
            console.error('Error fetching weekly RSI:', error);
        }
    };

    const updateRsiChart = (timestamps, rsiValues) => {
        if (rsiChart) {
            rsiChart.destroy();
        }
        rsiChart = new Chart(rsiChartCanvas, {
            type: 'line',
            data: {
                labels: timestamps,
                datasets: [{
                    label: 'Weekly RSI',
                    data: rsiValues,
                    borderColor: 'rgba(75, 192, 192, 1)',
                    backgroundColor: 'rgba(75, 192, 192, 0.2)',
                    fill: true,
                    tension: 0.1
                }]
            },
            options: {
                responsive: true,
                scales: {
                    y: {
                        beginAtZero: false,
                        max: 100,
                        min: 0
                    }
                },
                plugins: {
                    legend: {
                        display: true
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false
                    }
                }
            }
        });
    };

    fetchButton.addEventListener('click', () => {
        const ticker = tickerInput.value.trim().toUpperCase();
        if (ticker) {
            fetchData(ticker);
        }
    });

    expirationDateDropdown.addEventListener('change', () => {
        const selectedDate = expirationDateDropdown.value;
        if (currentTicker && selectedDate) {
            fetchData(currentTicker, selectedDate);
        }
    });

    strikePriceDropdown.addEventListener('change', () => {
        const selectedDate = expirationDateDropdown.value;
        const selectedStrike = strikePriceDropdown.value;
        if (currentTicker && selectedDate && selectedStrike) {
            fetchData(currentTicker, selectedDate, selectedStrike);
        }
    });

    themeSwitch.addEventListener('change', () => {
        if (themeSwitch.checked) {
            document.documentElement.setAttribute('data-theme', 'dark');
        } else {
            document.documentElement.removeAttribute('data-theme');
        }
    });

    // Initial fetch for default ticker on page load
    fetchData(currentTicker);
});