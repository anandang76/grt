<?php

/*
 | Instrument universe for the watchlist and history tools, grouped for the config screen:
 |   nifty50  — NIFTY 50 stocks (NSE)
 |   next50   — Nifty Next 50 stocks (NSE)
 |   mcx      — MCX commodities
 |   index    — index instruments (NSE / BSE)
 |
 | security_id / segment are Dhan identifiers for real data (only a few stock ids are confirmed;
 | the rest are null and must be filled from Dhan's instrument master). `base` is an approximate
 | ₹ level used only to seed demo candles and the demo 52-week high/low until real data is wired.
 */

$s = fn (string $symbol, string $name, float $base, ?string $id = null) => [
    'symbol' => $symbol, 'name' => $name, 'base' => $base, 'security_id' => $id, 'segment' => 'NSE_EQ', 'exchange' => 'NSE', 'kind' => 'stock', 'group' => 'nifty50',
];
$nxt = fn (string $symbol, string $name, float $base) => [
    'symbol' => $symbol, 'name' => $name, 'base' => $base, 'security_id' => null, 'segment' => 'NSE_EQ', 'exchange' => 'NSE', 'kind' => 'stock', 'group' => 'next50',
];
$mcx = fn (string $symbol, string $name, float $base) => [
    'symbol' => $symbol, 'name' => $name, 'base' => $base, 'security_id' => null, 'segment' => 'MCX_COMM', 'exchange' => 'MCX', 'kind' => 'commodity', 'group' => 'mcx',
];
$idx = fn (string $symbol, string $name, float $base, string $exch = 'NSE') => [
    'symbol' => $symbol, 'name' => $name, 'base' => $base, 'security_id' => null, 'segment' => 'IDX_I', 'exchange' => $exch, 'kind' => 'index', 'group' => 'index',
];

return [
    // ---- NIFTY 50 ----
    $s('ADANIENT', 'Adani Enterprises', 2400, '25'),
    $s('ADANIPORTS', 'Adani Ports & SEZ', 1350, '15083'),
    $s('APOLLOHOSP', 'Apollo Hospitals', 7000),
    $s('ASIANPAINT', 'Asian Paints', 2500),
    $s('AXISBANK', 'Axis Bank', 1150),
    $s('BAJAJ-AUTO', 'Bajaj Auto', 9500),
    $s('BAJFINANCE', 'Bajaj Finance', 1080, '317'),
    $s('BAJAJFINSV', 'Bajaj Finserv', 1650),
    $s('BEL', 'Bharat Electronics', 290),
    $s('BHARTIARTL', 'Bharti Airtel', 1600, '10604'),
    $s('CIPLA', 'Cipla', 1500),
    $s('COALINDIA', 'Coal India', 410),
    $s('DRREDDY', "Dr. Reddy's Labs", 1250),
    $s('EICHERMOT', 'Eicher Motors', 8100),
    $s('GRASIM', 'Grasim Industries', 2600),
    $s('HCLTECH', 'HCL Technologies', 1800, '7229'),
    $s('HDFCBANK', 'HDFC Bank', 1750),
    $s('HDFCLIFE', 'HDFC Life Insurance', 700),
    $s('HEROMOTOCO', 'Hero MotoCorp', 4800),
    $s('HINDALCO', 'Hindalco Industries', 650),
    $s('HINDUNILVR', 'Hindustan Unilever', 2500),
    $s('ICICIBANK', 'ICICI Bank', 1300),
    $s('INDUSINDBK', 'IndusInd Bank', 1000),
    $s('INFY', 'Infosys', 1850, '1594'),
    $s('ITC', 'ITC', 480),
    $s('JSWSTEEL', 'JSW Steel', 1000),
    $s('KOTAKBANK', 'Kotak Mahindra Bank', 1800),
    $s('LT', 'Larsen & Toubro', 3600),
    $s('M&M', 'Mahindra & Mahindra', 3000, '2031'),
    $s('MARUTI', 'Maruti Suzuki', 12000),
    $s('NESTLEIND', 'Nestle India', 2300),
    $s('NTPC', 'NTPC', 360),
    $s('ONGC', 'Oil & Natural Gas Corp', 250),
    $s('POWERGRID', 'Power Grid Corp', 290),
    $s('RELIANCE', 'Reliance Industries', 1347, '2885'),
    $s('SBILIFE', 'SBI Life Insurance', 1500),
    $s('SBIN', 'State Bank of India', 820),
    $s('SHRIRAMFIN', 'Shriram Finance', 600),
    $s('SUNPHARMA', 'Sun Pharmaceutical', 1700),
    $s('TATACONSUM', 'Tata Consumer Products', 1100),
    $s('TATAMOTORS', 'Tata Motors', 780),
    $s('TATASTEEL', 'Tata Steel', 150, '3499'),
    $s('TCS', 'Tata Consultancy Services', 2340, '11536'),
    $s('TECHM', 'Tech Mahindra', 1600),
    $s('TITAN', 'Titan Company', 3400),
    $s('TRENT', 'Trent', 6500),
    $s('ULTRACEMCO', 'UltraTech Cement', 11500),
    $s('WIPRO', 'Wipro', 300),
    $s('JIOFIN', 'Jio Financial Services', 320),
    $s('ADANIGREEN', 'Adani Green Energy', 1100),

    // ---- Nifty Next 50 ----
    $nxt('ABB', 'ABB India', 6500),
    $nxt('ADANIENSOL', 'Adani Energy Solutions', 850),
    $nxt('ADANIPOWER', 'Adani Power', 550),
    $nxt('AMBUJACEM', 'Ambuja Cements', 550),
    $nxt('DMART', 'Avenue Supermarts', 3800),
    $nxt('BANKBARODA', 'Bank of Baroda', 240),
    $nxt('BERGEPAINT', 'Berger Paints', 520),
    $nxt('BHEL', 'Bharat Heavy Electricals', 230),
    $nxt('BPCL', 'Bharat Petroleum', 300),
    $nxt('BOSCHLTD', 'Bosch', 32000),
    $nxt('BRITANNIA', 'Britannia Industries', 4800),
    $nxt('CANBK', 'Canara Bank', 95),
    $nxt('CGPOWER', 'CG Power & Industrial', 680),
    $nxt('CHOLAFIN', 'Cholamandalam Investment', 1400),
    $nxt('COLPAL', 'Colgate-Palmolive India', 2600),
    $nxt('DABUR', 'Dabur India', 520),
    $nxt('DIVISLAB', "Divi's Laboratories", 5800),
    $nxt('DLF', 'DLF', 780),
    $nxt('GAIL', 'GAIL India', 190),
    $nxt('GODREJCP', 'Godrej Consumer Products', 1200),
    $nxt('HAVELLS', 'Havells India', 1600),
    $nxt('HAL', 'Hindustan Aeronautics', 4200),
    $nxt('HDFCAMC', 'HDFC Asset Management', 4200),
    $nxt('ICICIGI', 'ICICI Lombard General Ins.', 1900),
    $nxt('ICICIPRULI', 'ICICI Prudential Life', 650),
    $nxt('INDHOTEL', 'Indian Hotels', 780),
    $nxt('INDIGO', 'InterGlobe Aviation', 4500),
    $nxt('IOC', 'Indian Oil', 140),
    $nxt('IRFC', 'Indian Railway Finance', 150),
    $nxt('JINDALSTEL', 'Jindal Steel & Power', 950),
    $nxt('JSWENERGY', 'JSW Energy', 580),
    $nxt('LICI', 'Life Insurance Corp', 900),
    $nxt('LODHA', 'Macrotech Developers', 1300),
    $nxt('LTIM', 'LTIMindtree', 6200),
    $nxt('MARICO', 'Marico', 650),
    $nxt('MOTHERSON', 'Samvardhana Motherson', 160),
    $nxt('NAUKRI', 'Info Edge India', 1400),
    $nxt('PFC', 'Power Finance Corp', 420),
    $nxt('PIDILITIND', 'Pidilite Industries', 3000),
    $nxt('PNB', 'Punjab National Bank', 100),
    $nxt('RECLTD', 'REC', 500),
    $nxt('SBICARD', 'SBI Cards & Payment', 750),
    $nxt('SHREECEM', 'Shree Cement', 27000),
    $nxt('SIEMENS', 'Siemens India', 6800),
    $nxt('SRF', 'SRF', 2300),
    $nxt('TATAPOWER', 'Tata Power', 420),
    $nxt('TORNTPHARM', 'Torrent Pharmaceuticals', 3300),
    $nxt('TVSMOTOR', 'TVS Motor', 2800),
    $nxt('UNIONBANK', 'Union Bank of India', 120),
    $nxt('VBL', 'Varun Beverages', 620),

    // ---- MCX commodities ----
    $mcx('GOLD', 'Gold (per 10g)', 120000),
    $mcx('GOLDM', 'Gold Mini (per 10g)', 120000),
    $mcx('GOLDGUINEA', 'Gold Guinea (per 8g)', 96000),
    $mcx('GOLDPETAL', 'Gold Petal (per 1g)', 12000),
    $mcx('SILVER', 'Silver (per kg)', 95000),
    $mcx('SILVERM', 'Silver Mini (per kg)', 95000),

    // ---- Indices ----
    $idx('NIFTY 50', 'NIFTY 50 Index', 25700, 'NSE'),
    $idx('BANKNIFTY', 'Nifty Bank Index', 58000, 'NSE'),
    $idx('GIFTNIFTY', 'GIFT Nifty', 25750, 'NSE'),
    $idx('SENSEX', 'BSE SENSEX', 82000, 'BSE'),
];
