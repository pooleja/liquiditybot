var Env = require('./config/env.js');

var mongoose = require('mongoose');
mongoose.connect(Env.MONGO_CONNECTION_STRING);
var Order = require('./models/order.js');

var winston = require('winston');
winston.add(winston.transports.File, { filename: 'listener.log' });


var ReadWriteLock = require('rwlock');
var lock = new ReadWriteLock();


var CoinbaseExchange = require('coinbase-exchange');
var authedClient = new CoinbaseExchange.AuthenticatedClient(Env.ACCESS_KEY, Env.SECRET_KEY, Env.PASSPHRASE_KEY, Env.REST_URL);
var websocket = new CoinbaseExchange.WebsocketClient('BTC-USD', Env.SOCKET_URL);


websocket.on('close', function(data){

  winston.log('info', "Closing?");
  winston.log('info', JSON.stringify(data));

  process.exit(-1);

});

winston.log('info', "Listening for messages...");

websocket.on('message', function(data) {

  if(data.type == 'done' && data.reason == 'filled'){

    lock.writeLock(function (writeRelease) {

      Order.findOne({ id : data.order_id }, function(err, foundOrder){

        // Verify that we found a video with that ID
        if(err){
           winston.log('info', "Failed to find order " + data.order_id + " with error " + err);
           writeRelease();
           return;
        }

        // If we are not tracking this order then just bail
        if(!foundOrder){
          writeRelease();
          return;
        }

        winston.log('info', "------------------------------------------------------------");
        winston.log('info', data);

        var closedOrder = foundOrder;
        winston.log('info', "Closed Order: " + JSON.stringify(closedOrder));

        if(closedOrder.side == 'buy' ){

          // Create a sell order at old price + $1
          winston.log('info', "Closed buy order found.  Creating new sell order at price + 1");

          var orderToCreate = {
            size : closedOrder.size,
            price : (Number(closedOrder.price) + ( 1 * Env.GAP_AMOUNT)).toFixed(2) ,
            side : "sell",
            product_id : "BTC-USD"
          };

          winston.log("info", JSON.stringify(orderToCreate));

          authedClient.sell(orderToCreate, function(error, response, data){

            if (error || response.statusCode != 200) {
              winston.log('error', "Error creating new sell order: " + error);
              winston.log('error', "Response: " + JSON.stringify(response));
              winston.log('info', "Trying again in 1 second...");

              setTimeout(function() {
                authedClient.sell(orderToCreate, function(error, response, data){
                  if (error || response.statusCode != 200) {
                    winston.log('error', "Failed again... bailing");
                    writeRelease;
                    return;
                  }

                  // Add the new sell order to the existing order list
                  orderToCreate.id = data.id;
                  winston.log('info', "Created Order: " + JSON.stringify(orderToCreate));

                  Order(orderToCreate).save(function(error){

                    if(error){
                      winston.log('error', "Failed to create order" + orderToCreate.id + " with errro " + error);
                      writeRelease();
                      return;
                    }

                    closedOrder.remove(function(error){
                      if(error){
                        winston.log('error', "Failed to remove order" + closedOrder.id + " with errro " + error);
                        writeRelease();
                        return;
                      }
                    });

                  });
                  
                });
              }, 1000);

            }

          });


        } else {

          // Create a buy order at old price - $1
          winston.log('info', "Closed sell order found.  Creating new buy order at price - 1");

          var orderToCreate = {
            size : closedOrder.size,
            price : (Number(closedOrder.price) - ( 1 * Env.GAP_AMOUNT)).toFixed(2) ,
            side : "buy",
            product_id : "BTC-USD"
          };

          winston.log("info", JSON.stringify(orderToCreate));

          authedClient.buy(orderToCreate, function(error, response, data){

            if (error || response.statusCode != 200) {
              winston.log('error', "Error creating new buy order: " + error);
              winston.log('error', "Response: " + JSON.stringify(response));
              winston.log('info', "Trying again in 1 second...");

              setTimeout(function() {
                authedClient.buy(orderToCreate, function(error, response, data){
                  if (error || response.statusCode != 200) {
                    winston.log('error', "Failed again... bailing");
                    writeRelease;
                    return;
                  }

                  // Add the new sell order to the existing order list
                  orderToCreate.id = data.id;
                  winston.log('info', "Created Order: " + JSON.stringify(orderToCreate));

                  Order(orderToCreate).save(function(error){

                    if(error){
                      winston.log('error', "Failed to create order" + orderToCreate.id + " with errro " + error);
                      writeRelease();
                      return;
                    }

                    closedOrder.remove(function(error){
                      if(error){
                        winston.log('error', "Failed to remove order" + closedOrder.id + " with errro " + error);
                        writeRelease();
                        return;
                      }
                    });

                  });

                });
              }, 1000);
            }

          });

        }

      });


    });

  }

});
