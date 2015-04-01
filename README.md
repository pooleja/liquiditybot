Goal
* Make money off volatility
* Assumption - Long term trend of bitcoin will be up
  * If this is not the case, then this will not work

Algorithm
* Place Buys/Sells at specified intervals (ever $1 for example)
* Start by taking $X and placing an equal buy amount (Y BTC) below the current market price at each interval
* If the price goes lower then it will trigger a buy for that order
  * Immediately place a sell order for that bitcoin at $1 higher than the buy price was triggered
    * If a sell order is filled, immediately place a buy order at $1 lower than the sell price was triggered

Reset: If the price goes $10 higher than the highest buy price (and no btc is owned) then reset and create all new buy orders below the current price

If the price goes below all open orders then there is nothing that can be done and we must wait for the price to come back up.

Docs: https://docs.exchange.coinbase.com/?javascript#orders


* Get available balance to use
* Split value by 50 to get $X
* Get market price
  * At every $1 interval below market create an order to buy $X 
* Store orders in db
* List to market stream for “Done” orders
* For any “Done” orders
  * If it was a “buy” order that was filled, open a “sell” order for BTC fill amount at price + $1
  * If it was a “sell” order that was filled, open a “buy” order for all available USD at price - $1
