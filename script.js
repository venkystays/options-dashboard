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

    const showLoading = (isLoading) => {
        if (isLoading) {
            loadingOverlay.classList.add('show');
        } else {
            loadingOverlay.classList.remove('show');
        }
    };

    const fetchData = async (ticker) => {
        showLoading(true);

        try {
            const response = await fetch(`http://localhost:8081/api/options/${ticker}`);
            const data = await response.json();

            if (response.ok) {
                stockNameDisplay.textContent = data.companyName || 'N/A';
                currentPriceDisplay.textContent = data.currentPrice ? `$${data.currentPrice}` : 'N/A';
                rsiValue.textContent = data.rsi || 'N/A';
                pcrValue.textContent = data.putCallRatio || 'N/A';
                ivValue.textContent = data.impliedVolatility || 'N/A';
                rvValue.textContent = data.realizedVolatility || 'N/A';
                hvValue.textContent = data.historicVolatility || 'N/A';
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

    themeSwitch.addEventListener('change', () => {
        if (themeSwitch.checked) {
            document.documentElement.setAttribute('data-theme', 'dark');
        } else {
            document.documentElement.removeAttribute('data-theme');
        }
    });

    // Fetch data for a default ticker on page load
    fetchData('AAPL');
});