document.addEventListener('DOMContentLoaded', () => {
    const stockNameDisplay = document.getElementById('stockName');
    const currentPriceDisplay = document.getElementById('currentPrice');
    const rsiValue = document.getElementById('rsiValue');
    const pcrValue = document.getElementById('pcrValue');
    const ivValue = document.getElementById('ivValue');
    const rvValue = document.getElementById('rvValue');
    const hvValue = document.getElementById('hvValue');
    const tickerInput = document.getElementById('tickerInput');
    const fetchButton = document.getElementById('fetchButton');
    const themeSwitch = document.getElementById('theme-switch');
    const loadingOverlay = document.getElementById('loadingOverlay');
    const expirationDateDropdown = document.getElementById('expirationDateDropdown');

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

    const fetchData = async (ticker, expirationDate = null) => {
        showLoading(true);
        currentTicker = ticker; // Update current ticker

        let url = `http://localhost:8081/api/options/${ticker}`;
        if (expirationDate) {
            url += `?expirationDate=${expirationDate}`;
        }

        try {
            const response = await fetch(url);
            const data = await response.json();

            if (response.ok) {
                stockNameDisplay.textContent = data.companyName || 'N/A';
                currentPriceDisplay.textContent = data.currentPrice ? `${data.currentPrice}` : 'N/A';
                rsiValue.textContent = data.rsi || 'N/A';
                pcrValue.textContent = data.putCallRatio || 'N/A';
                ivValue.textContent = data.impliedVolatility || 'N/A';
                rvValue.textContent = data.realizedVolatility || 'N/A';
                hvValue.textContent = data.historicVolatility || 'N/A';

                // Populate expiration dates dropdown only if not already populated for a specific date fetch
                if (!expirationDate) {
                    populateExpirationDates(data.expirationDates);
                }

            } else {
                throw new Error(data.error || 'Unknown error from backend');
            }

        } catch (error) {
            console.error('Error fetching data from Go backend:', error);
            stockNameDisplay.textContent = 'Failed to fetch data. Please try again.';
            currentPriceDisplay.textContent = 'N/A';
            rsiValue.textContent = 'N/A';
            pcrValue.textContent = 'N/A';
            ivValue.textContent = 'N/A';
            rvValue.textContent = 'N/A';
            hvValue.textContent = 'N/A';
            populateExpirationDates([]); // Clear dropdown on error
        } finally {
            showLoading(false);
        }
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