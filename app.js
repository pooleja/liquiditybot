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

if(Env.DELETE_PREVIOUS){

  // Clear all orders
  Order.remove({}, function(err){
    if(err){
      winston.log('error', "Error removing orders: " + error);
      process.exit(-1);
    }

    // Now create new orders
    createBids();

  });
} else {

  // Create new orders without deleting old ones
  createBids();

}


function createBids(){
    // Subtract 1% for fees
    var available = Env.AMOUNT_USD * 0.99;

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
            size : "" + size.toFixed(2),
            price : "" + orderPrice.toFixed(2),
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
}
