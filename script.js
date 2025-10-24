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

    const showLoading = (isLoading) => {
        if (isLoading) {
            stockNameDisplay.textContent = 'Fetching...';
            currentPriceDisplay.textContent = '...';
            rsiValue.textContent = '...';
            pcrValue.textContent = '...';
            ivValue.textContent = '...';
            rvValue.textContent = '...';
            hvValue.textContent = '...';
            fetchButton.disabled = true;
            fetchButton.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Fetching...';
        } else {
            fetchButton.disabled = false;
            fetchButton.innerHTML = 'Get Insights';
        }
    };

    const fetchData = async (ticker) => {
        showLoading(true);

        try {
            const response = await fetch(`http://localhost:8080/api/options/${ticker}`);
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

    // Fetch data for a default ticker on page load
    fetchData('AAPL');
});