require("console-stamp")(console, "HH:MM:ss.l");

var Env = require('./config/env.js');
var CoinbaseExchange = require('coinbase-exchange');

/*
var websocket = new CoinbaseExchange.WebsocketClient('BTC-USD', Env.SOCKET_URL);
websocket.on('message', function(data) { console.log("message" + data); });
websocket.on('error', function(data){ console.log("error" + data); });
websocket.on('open', function(data){
  console.log("open" + data);


});
websocket.on('close', function(data){ console.log("close" + data); });
*/

console.log("asdf");
var authedClient = new CoinbaseExchange.AuthenticatedClient(Env.ACCESS_KEY, Env.SECRET_KEY, Env.PASSPHRASE_KEY, Env.REST_URL);
authedClient.getAccounts(function(error, response, data){
  console.log(JSON.stringify(data));
});
