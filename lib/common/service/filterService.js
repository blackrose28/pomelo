'use strict';

const logger = require('pomelo-logger').getLogger('pomelo', __filename);
const PmlError = require('../../errors').PomeloError;
const utils = require('../../util/utils');

/**
 * Filter service.
 * Register and fire before and after filters.
 */
module.exports = Service;

function Service(/* app */) {
  this.befores = [];    // before filters
  this.afters = [];     // after filters
}

Service.prototype.name = 'filter';

/**
 * Add before filter into the filter chain.
 *
 * @param filter {Object|Function} filter instance or filter function.
 */
Service.prototype.before = function(filter) {
  this.befores.push(filter);
};

/**
 * Add after filter into the filter chain.
 *
 * @param filter {Object|Function} filter instance or filter function.
 */
Service.prototype.after = function(filter) {
  this.afters.unshift(filter);
};

/**
 * TODO: other insert method for filter? such as unshift
 */

/**
 * Do the before filter.
 * Fail over if any filter pass err parameter to the next function.
 *
 * @param msg {Object} clienet request msg
 * @param session {Object} a session object for current request
 * @param cb {Function} cb(err) callback function to invoke next chain node
 */
Service.prototype.beforeFilter = function(msg, session, cb) {
  let index = 0;

  const next = (err, resp, opts) => {

    if (err || index >= this.befores.length) {
      utils.invokeCallback(err, resp, opts);
      return;
    }

    const handler = this.befores[index++];

    if (typeof handler === 'function') {
      handler(msg, session, next);
    } else if (typeof handler.before === 'function') {
      handler.before(msg, session, next);
    } else {
      logger.error('meet invalid before filter, ' +
                   'handler or handler.before should be function.');
      next(new PmlError('invalid before filter.'));
    }
  }; //end of next

  next();
};

/**
 * Do after filter chain.
 * Give server a chance to do clean up jobs after request responsed.
 * After filter can not change the request flow before.
 * After filter should call the next callback to
 * let the request pass to next after filter.
 *
 * @param err {Object} error object
 * @param session {Object} session object for current request
 * @param {Object} resp response object send to client
 * @param cb {Function} cb(err) callback function to invoke next chain node
 */
Service.prototype.afterFilter = function(err, msg, session, resp, cb) {
  let index = 0;

  const next = (err) => {
    //if done
    if (index >= this.afters.length) {
      utils.invokeCallback(cb, err);
      return;
    }

    const handler = this.afters[index++];

    if (typeof handler === 'function') {
      handler(err, msg, session, resp, next);
    } else if (typeof handler.after === 'function') {
      handler.after(err, msg, session, resp, next);
    } else {
      logger.error('meet invalid after filter, ' +
                   'handler or handler.after should be function.');
      next(new PmlError('invalid after filter.'));
    }
  }; //end of next

  next(err);
};
