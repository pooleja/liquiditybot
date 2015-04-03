var Env = require('./config/env.js');
var CoinbaseExchange = require('coinbase-exchange');
var async = require('async');

var mongoose = require('mongoose');
mongoose.connect(Env.MONGO_CONNECTION_STRING);
var Order = require('./models/order.js');

var winston = require('winston');
winston.add(winston.transports.File, { filename: 'app.log' });

winston.log('info', "Getting available balance.");

var authedClient = new CoinbaseExchange.AuthenticatedClient(Env.ACCESS_KEY, Env.SECRET_KEY, Env.PASSPHRASE_KEY, Env.REST_URL);

// Clear all orders
Order.remove({}, function(err){
  if(err){
    winston.log('error', "Error removing orders: " + error);
    process.exit(-1);
  }

  authedClient.getAccount(Env.ACCOUNT_ID, function(error, response, data){

    if (error || response.statusCode != 200) {
      winston.log('info', "Error getting accounts: " + error);
      winston.log('info', "Response: " + JSON.stringify(response));
      return;
    }

    winston.log('info', "Account info: " + JSON.stringify(data));

    var available = Number(data.available);

    // Subtract 1% for fees
    available = available * 0.99;

    winston.log('info', "Amount available in account: $" + available);

    var amountPerOrder = available / Env.ORDER_COUNT;

    winston.log('info', "Amount per buy order: " + amountPerOrder);

    authedClient.getProducts(function(error, response, data){

      winston.log('info', "Products: " + JSON.stringify(data));

      authedClient.getProductTicker(function(error, response, data){

        if (error || response.statusCode != 200) {
          winston.log('info', "Error getting ticker: " + error);
          winston.log('info', "Response: " + JSON.stringify(response));
          return;
        }

        winston.log('info', JSON.stringify(data));

        var currentPrice = Number(data.price);
        winston.log('info', "Current market price: $" + currentPrice);

        var startPrice = Math.floor( currentPrice );
        winston.log('info', "Starting price: $" + startPrice);

        var ordersToCreate = [ ];

        for(var i = 0; i < Env.ORDER_COUNT ; i++){

          var orderPrice = startPrice - ( i * Env.GAP_AMOUNT) ;
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
              winston.log('info', "Error creating buy order: " + error);
              winston.log('info', "Response: " + JSON.stringify(response));
              callback("Failed to place order: " + JSON.stringify(order));
            }

            order.id = data.id;

            Order(order).save(function(error){

              if(error){
                winston.log('error', "Failed to create order" + order.id + " with errro " + error);
                callback(error);
                return;
              }

              callback();
            });

          });

        }, function(err){
          if(err){
            winston.log('info', 'Order creation failed: ' + err);
          } else {

            winston.log('info', "Finished creating orders");
            winston.log('info', JSON.stringify(ordersToCreate[0]));

            //listenForOrders(ordersToCreate);
            process.exit();
          }
        });


      });

    });

  });


});


var hashedOrders = {};

function createOrderHash(orders){

  for(var i = 0 ; i < Env.ORDER_COUNT; i++){
    item = orders[i];
    hashedOrders[item.id] = item;
  }

  return hashedOrders;
}

function listenForOrders(orders){
  var websocket = new CoinbaseExchange.WebsocketClient('BTC-USD', Env.SOCKET_URL);
  websocket.on('close', function(data){

    winston.log('info', "Closing?");
    winston.log('info', JSON.stringify(data));

  });

  websocket.on('message', function(data) {

    createOrderHash(orders);

    if(data.type == 'done'){



      if(hashedOrders[data.order_id]){

        winston.log('info', "");
        winston.log('info', "------------------------------------------------------------");
        winston.log('info', (new Date()).toString());
        winston.log('info', data);

        var closedOrder = hashedOrders[data.order_id];
        winston.log('info', "Closed Order: " + JSON.stringify(closedOrder));

        if(closedOrder.side == 'buy' ){

          // Create a sell order at old price + $1
          winston.log('info', "Closed buy order found.  Creating new sell order at price + 1");

          var orderToCreate = {
            size : closedOrder.size,
            price : Number(closedOrder.price) + ( 1 * Env.GAP_AMOUNT) ,
            side : "sell",
            product_id : "BTC-USD"
          };

          authedClient.sell(orderToCreate, function(error, response, data){

            if (error || response.statusCode != 200) {
              winston.log('error', "Error creating new sell order: " + error);
              winston.log('error', "Response: " + JSON.stringify(response));
            }

            // Add the new sell order to the existing order list
            orderToCreate.id = data.id;
            hashedOrders[data.id] = orderToCreate;
            winston.log('info', "Created Order: " + JSON.stringify(orderToCreate));

            // Delete the closed order
            delete hashedOrders[closedOrder.id];

          });


        } else {

          // Create a buy order at old price - $1
          winston.log('info', "Closed sell order found.  Creating new buy order at price - 1");

          var orderToCreate = {
            size : closedOrder.size,
            price : Number(closedOrder.price) - ( 1 * Env.GAP_AMOUNT) ,
            side : "buy",
            product_id : "BTC-USD"
          };

          authedClient.buy(orderToCreate, function(error, response, data){

            if (error || response.statusCode != 200) {
              winston.log('error', "Error creating new buy order: " + error);
              winston.log('error', "Response: " + JSON.stringify(response));
            }

            // Add the new sell order to the existing order list
            orderToCreate.id = data.id;
            hashedOrders[data.id] = orderToCreate;
            winston.log('info', "Created Order: " + JSON.stringify(orderToCreate));

            // Delete the closed order
            delete hashedOrders[closedOrder.id];

          });

        }


      }
    }

  });
}
