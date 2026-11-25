<?php

/*
 | NIFTY 50 constituents for the watchlist config.
 |
 | security_id / segment are Dhan instrument identifiers used for real market data.
 | The confirmed ones come from the existing dhan6 project; the rest are null and must be
 | filled from Dhan's instrument master (https://images.dhan.co/api-data/api-scrip-master.csv)
 | before enabling live data. Charts run on mock data keyed by `symbol` until then, so nulls
 | are fine for now. Membership changes occasionally — edit this list as needed.
 */

$s = fn (string $symbol, string $name, ?string $id = null) => [
    'symbol' => $symbol,
    'name' => $name,
    'security_id' => $id,
    'segment' => 'NSE_EQ',
];

return [
    $s('ADANIENT', 'Adani Enterprises', '25'),
    $s('ADANIPORTS', 'Adani Ports & SEZ', '15083'),
    $s('APOLLOHOSP', 'Apollo Hospitals'),
    $s('ASIANPAINT', 'Asian Paints'),
    $s('AXISBANK', 'Axis Bank'),
    $s('BAJAJ-AUTO', 'Bajaj Auto'),
    $s('BAJFINANCE', 'Bajaj Finance', '317'),
    $s('BAJAJFINSV', 'Bajaj Finserv'),
    $s('BEL', 'Bharat Electronics'),
    $s('BHARTIARTL', 'Bharti Airtel', '10604'),
    $s('CIPLA', 'Cipla'),
    $s('COALINDIA', 'Coal India'),
    $s('DRREDDY', "Dr. Reddy's Labs"),
    $s('EICHERMOT', 'Eicher Motors'),
    $s('GRASIM', 'Grasim Industries'),
    $s('HCLTECH', 'HCL Technologies', '7229'),
    $s('HDFCBANK', 'HDFC Bank'),
    $s('HDFCLIFE', 'HDFC Life Insurance'),
    $s('HEROMOTOCO', 'Hero MotoCorp'),
    $s('HINDALCO', 'Hindalco Industries'),
    $s('HINDUNILVR', 'Hindustan Unilever'),
    $s('ICICIBANK', 'ICICI Bank'),
    $s('INDUSINDBK', 'IndusInd Bank'),
    $s('INFY', 'Infosys', '1594'),
    $s('ITC', 'ITC'),
    $s('JSWSTEEL', 'JSW Steel'),
    $s('KOTAKBANK', 'Kotak Mahindra Bank'),
    $s('LT', 'Larsen & Toubro'),
    $s('M&M', 'Mahindra & Mahindra', '2031'),
    $s('MARUTI', 'Maruti Suzuki'),
    $s('NESTLEIND', 'Nestle India'),
    $s('NTPC', 'NTPC'),
    $s('ONGC', 'Oil & Natural Gas Corp'),
    $s('POWERGRID', 'Power Grid Corp'),
    $s('RELIANCE', 'Reliance Industries', '2885'),
    $s('SBILIFE', 'SBI Life Insurance'),
    $s('SBIN', 'State Bank of India'),
    $s('SHRIRAMFIN', 'Shriram Finance'),
    $s('SUNPHARMA', 'Sun Pharmaceutical'),
    $s('TATACONSUM', 'Tata Consumer Products'),
    $s('TATAMOTORS', 'Tata Motors'),
    $s('TATASTEEL', 'Tata Steel', '3499'),
    $s('TCS', 'Tata Consultancy Services', '11536'),
    $s('TECHM', 'Tech Mahindra'),
    $s('TITAN', 'Titan Company'),
    $s('TRENT', 'Trent'),
    $s('ULTRACEMCO', 'UltraTech Cement'),
    $s('WIPRO', 'Wipro'),
    $s('JIOFIN', 'Jio Financial Services'),
    $s('ADANIGREEN', 'Adani Green Energy'),
];
