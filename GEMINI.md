# Options Dashboard

## Project Overview

This project is a web-based stock options dashboard that provides key metrics for a given stock ticker.

*   **Backend:** The backend is written in Go and uses the `net/http` package to serve a simple web server. It fetches financial data from Yahoo Finance using the `github.com/oscarli916/yahoo-finance-api` and `github.com/ggoodwin/stocks-go` libraries. The backend provides an API endpoint to deliver consolidated options data to the frontend.

*   **Frontend:** The frontend is built with plain HTML, CSS, and JavaScript. It makes an API call to the Go backend to retrieve the options data and displays it in a simple dashboard format.

## Building and Running

1.  **Run the backend:**
    ```bash
    go run main.go
    ```
    The server will start on port 8081.

2.  **Open the frontend:**
    Open `index.html` in your web browser. The page will automatically fetch and display the options data for the hardcoded ticker 'BAC'.

## Development Conventions

*   The Go backend follows standard Go conventions.
*   The frontend code is simple and does not follow any specific framework.
*   The ticker symbol is currently hardcoded in `script.js`. To view data for a different stock, you will need to modify this file.
