/*won't be hardcoded in the future*/
var paymentHandler = 'paypal';

if (!paymentHandler) {
	winston.info('Database type not set!');
}

var payment = require('./payment/' + paymentHandler);

module.exports = payment;   