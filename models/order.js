var mongoose = require('mongoose');

var orderSchema = mongoose.Schema({

   id: {type: String, required: true, unique: true},
   size : String,
   price : Number,
   side : String,
   product_id : {type: String, default: 'BTC-USD'}

});

module.exports = mongoose.model('Order', orderSchema);
