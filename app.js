var Env = require('./config/env.js');
var CoinbaseExchange = require('coinbase-exchange');
var async = require('async');

console.log("Getting available balance.");

var authedClient = new CoinbaseExchange.AuthenticatedClient(Env.ACCESS_KEY, Env.SECRET_KEY, Env.PASSPHRASE_KEY, Env.REST_URL);

authedClient.getAccount(Env.ACCOUNT_ID, function(error, response, data){

  if (error || response.statusCode != 200) {
    console.log("Error getting accounts: " + error);
    console.log("Response: " + JSON.stringify(response));
    return;
  }

  console.log("Account info: " + JSON.stringify(data));

  var available = Number(data.available);

  // Subtract 1% for fees
  available = available * 0.99;

  console.log("Amount available in account: $" + available);

  var amountPerOrder = available / Env.ORDER_COUNT;

  console.log("Amount per buy order: " + amountPerOrder);

  authedClient.getProducts(function(error, response, data){

    console.log("Products: " + JSON.stringify(data));

    authedClient.getProductTicker(function(error, response, data){

      if (error || response.statusCode != 200) {
        console.log("Error getting ticker: " + error);
        console.log("Response: " + JSON.stringify(response));
        return;
      }

      console.log(JSON.stringify(data));

      var currentPrice = Number(data.price);
      console.log("Current market price: $" + currentPrice);

      var startPrice = Math.floor( currentPrice );
      console.log("Starting price: $" + startPrice);

      var ordersToCreate = [ ];

      for(var i = 0; i < Env.ORDER_COUNT ; i++){

        var orderPrice = startPrice - i;
        var size = amountPerOrder / orderPrice ;

        var orderToCreate = {
          size : "" + size.toFixed(5),
          price : "" + orderPrice.toFixed(5),
          side : "buy",
          product_id : "BTC-USD"
        };

        ordersToCreate.push(orderToCreate);
      }

      async.eachSeries(ordersToCreate, function(order, callback){

        authedClient.buy(order, function(error, response, data){

          if (error || response.statusCode != 200) {
            console.log("Error creating buy order: " + error);
            console.log("Response: " + JSON.stringify(response));
            callback("Failed to place order");
          }

          order.id = data.id;
          callback();

        });

      }, function(err){
        if(err){
          console.log('Order creation failed: ' + err);
        } else {

          console.log("Finished creating orders");
          console.log(JSON.stringify(ordersToCreate[0]));

          listenForOrders(ordersToCreate);
        }
      });


    });

  });

});

function createOrderHash(orders){
  var hashed = {};

  for(var i = 0 ; i < Env.ORDER_COUNT; i++){
    item = orders[i];
    hashed[item.id] = item;
  }

  return hashed;
}

function listenForOrders(orders){
  var websocket = new CoinbaseExchange.WebsocketClient('BTC-USD', Env.SOCKET_URL);
  websocket.on('close', function(data){

    console.log("Closing?");
    console.log(JSON.stringify(data));

  });

  websocket.on('message', function(data) {



    var hashedOrders = createOrderHash(orders);

    if(data.type == 'done'){



      if(hashedOrders[data.order_id]){

        console.log(data);

        var closedOrder = hashedOrders[data.order_id];

        if(closedOrder.side == 'buy' ){

          // Create a sell order at old price + $1
          console.log("Closed buy order found.  Creating new sell order at price + 1");

          var orderToCreate = {
            size : closedOrder.size,
            price : Number(closedOrder.price) + 1,
            side : "sell",
            product_id : "BTC-USD"
          };

          authedClient.sell(orderToCreate, function(error, response, data){

            if (error || response.statusCode != 200) {
              console.log("Error creating new sell order: " + error);
              console.log("Response: " + JSON.stringify(response));
              callback("Failed to place order");
            }

            // Add the new sell order to the existing order list
            orderToCreate.id = data.id;
            hashedOrders[data.id] = orderToCreate;

            // Delete the closed order
            delete hashedOrders[closedOrder.id];

          });


        } else {

          // Create a buy order at old price - $1
          console.log("Closed sell order found.  Creating new buy order at price - 1");

          var orderToCreate = {
            size : closedOrder.size,
            price : Number(closedOrder.price) - 1,
            side : "buy",
            product_id : "BTC-USD"
          };

          authedClient.buy(orderToCreate, function(error, response, data){

            if (error || response.statusCode != 200) {
              console.log("Error creating new buy order: " + error);
              console.log("Response: " + JSON.stringify(response));
              callback("Failed to place order");
            }

            // Add the new sell order to the existing order list
            orderToCreate.id = data.id;
            hashedOrders[data.id] = orderToCreate;

            // Delete the closed order
            delete hashedOrders[closedOrder.id];

          });

        }


      }
    }

  });
}
