'use strict';

var async = module.parent.require('async'),
	request = module.parent.require('request'),
	winston = module.parent.require('winston'),
	cron = require('cron').CronJob,
	toMarkdown = require('to-markdown'),
	S = require('string'),

	nconf = module.parent.require('nconf'),
	meta = module.parent.require('./meta'),
	pubsub = module.parent.require('./pubsub'),
	topics = module.parent.require('./topics'),
	db = module.parent.require('./database'),
	user = module.parent.require('./user'),
	plugins = module.parent.require('./plugins'),
	
    controllers = require('./lib/controllers'),
    subscriptions = require('./lib/subscriptions');
    /*Paypal = require('paypal-recurring'),*/

(function(module) {

	var cronJobs = [];
	var settings = {};
	
	/*Make sensible cron jobs*/
    /*these should happen often*/
    cronJobs.push(new cron('00 00 0-23 * * *', function() { checkOnSubscriptions('justjoined'); }, null, false)); /*Checks if there's a trial period*/
    cronJobs.push(new cron('00 00 0-23 * * *', function() { checkOnSubscriptions('trial'); }, null, false));
    cronJobs.push(new cron('00 00 0-23 * * *', function() { checkOnSubscriptions('paid'); }, null, false));
    cronJobs.push(new cron('00 00 0-23 * * *', function() { checkOnSubscriptions('subscriptionexpired'); }, null, false)); /*Notifies user, kicks them out depending on mode*/
    
    function checkOnSubscriptions(status){
        /*get the subscription settings we'll pass on to the other functions*/
        var settings = [];
        subscriptions.getAllSubscriptionSettings(function(err, subscriptionsettings) {
            /*No settings? Make a speedy exit*/
			if (err || !Array.isArray(subscriptionsettings)) {
				return;
			}
            settings = subscriptionsettings;
		});
        /*Do we have any settings to go through at all?*/
        if(!settings || !settings.length){
            /*No? Then don't bother*/
            return;
        }
        /*Now we should have our settings, lets check on existing usersubscriptions*/
        subscriptions.getUserSubscriptions(function(err,usersubscriptions){
            if(err || !Array.isArray(usersubscriptions)){
                return;
            }
            
            usersubscriptions = usersubscriptions.filter(function(usersubscription) {
                return usersubscription && usersubscription.status == status;
            });
            /*perform a different set of actions based on the current status of the jobs in question*/
            performJobs(usersubscriptions,settings);
        });
    }
    
    /*Do all jobs handed over at once, with neat error messsages if things go wrong*/
    function performJobs(usersubscriptions,settingslist){
        /*pass groupsList down into doJob function*/
        async.eachSeries(usersubscriptions, 
            function(usersubscription, callback) {
                doJob(usersubscription,settingslist,callback);
            },function(err) {
                if(err) {
                    winston.error(err.message);
                }           
            }
        );
    }
    
    /*TODO: Refactor*/
    function doJob(usersubscription,groupsList,callback){
        if(!usersubscription){
            return callback();
        }
        if(!usersubscription.userGroupJoinedDate){
            usersubscription.userGroupJoinedDate = new Date();
        }
        if(!usersubscription.userGroupPaidDate){
            /*Paid Jan 1st of 1990...IE never*/
            usersubscription.userGroupJoinedDate = new Date(1990, 0, 1);
        }
        
        if(usersubscription.status == 'paid'){
            /*TODO: write test case for user subscription expiration*/
            /*Check to see if the user should be moved to the unpaid state based on the user's join date, the last paid date and cron job pattern*/
            var isStillPaid = false;
            if(isStillPaid){
                
            }else{
                onExpiredSubscriptionPeriod(job,callback);
            }
        }
        else if(job.status == 'subscriptionexpired'){
            /*Send message to user to pay/setup payment callback links*/
            
            /*Move to grace or removed state based on our settings*/
            /*filter our settings down to the one which maches the name handed over by the job*/
            groupsList = groupsList.filter(function(group){
               return groupsList && groupsList.name == job.groupname; 
            });
            
            /*do payment setup things*/
            
            onSuccessfulSetup(job,groupsList,callback);

        }
        else if(job.status == 'grace'){
            /*Like the "paid" state, keeps user in group, but is waiting to move back to paid state*/
            var isStillInGracePeriod = true;
            if(isStillInGracePeriod){
                /*Let the user use their grace period...do nothing*/
            }else{
                onExpiredGracePeriod(job,callback);
                onUserSubscriptionExpired(job,callback);
            }
        } 
        else if(job.status == 'blocked'){
            /*If users don't pay for a whole payment period, they move into the removed state*/
            var isStillInBlockedPeriod = true;
            if(isStillInBlockedPeriod){
                /*Let the user use their grace period...do nothing*/
            }else{
                onUserSubscriptionExpired(job,callback);
            }
        }
        else if(job.status == 'removedornew'){
            /*where users end up if they go past the grace period, at this point they must pay to get access to their category*/
        } else if(job.status == 'permanentmember'){
            /*TODO: Use this status to give special users permanent access*/
            /*Never do anything in this state*/
        }
        /*On successful payment call this function*/
        /*setSubscriptionJobField(job,'userGroupPaidDate',new Date(),callback);*/
    }

	plugins.isActive('nodebb-plugin-paypal-subscriptions', function(err, active) {
		if (err) {
			return winston.error(err.stack);
		}

		if (active) {
			reStartCronJobs();
		}
	});

	module.onClearRequireCache = function(data, callback) {
		stopCronJobs();
		cronJobs.length = 0;
		callback(null, data);
	};

	module.init = function(params, callback) {
	  	var router = params.router,
	  		hostMiddleware = params.middleware,
	  		hostControllers = params.controllers;
	  
        router.post('/api/admin/plugins/paypal-subscriptions/ipn/:sandbox', controllers.instantPaypalNotification);
	  	router.get('/admin/plugins/paypal-subscriptions', params.middleware.applyCSRF, hostMiddleware.admin.buildHeader, renderAdminPage);
	  	router.get('/api/admin/plugins/paypal-subscriptions', params.middleware.applyCSRF, renderAdminPage);
	  	router.post('/api/admin/plugins/paypal-subscriptions/save', params.middleware.applyCSRF, save);
	  
	  	callback();
	};
	
	function renderAdminPage(req, res, next) {
		async.parallel({
			groups: function(next) {
				subscriptions.getAllSubscriptionSettings(next);
			},
			settings: function(next) {
				admin.getSettings(next);
			}
		}, function(err, results) {
			if(err) {
				return next(err);
			}
			results.csrf = req.csrfToken();
			res.render('admin/plugins/paypal-subscriptions', results);
		});
	};

	function save(req, res, next) {
		subscriptions.deleteAllSubscriptionSettings(function(err) {
			if (err) {
				return next(err);
			}

			if (!req.body.groups) {
				return res.json({message:'Subscriptions Saved (no groups)!'});
			}

			async.parallel([
				function(next) {
					subscriptions.setSubscriptionSettings(req.body.groups, next);
				},
				function(next) {
					admin.saveSettings(req.body.settings, next);
				}
			], function(err) {
				if(err) {
					return next(err);
				}

				res.json({message: 'Subscriptions Saved!'});
			});
		});
	}

	function reStartCronJobs() {
		if (nconf.get('isPrimary') === 'true') {
			stopCronJobs();
			cronJobs.forEach(function(job) {
				job.start();
			});
		}
	}

	function stopCronJobs() {
		if (nconf.get('isPrimary') === 'true') {
			cronJobs.forEach(function(job) {
				job.stop();
			});
		}
	}
	/**/

	var admin = {};

	admin.menu = function(header, callback) {
		header.plugins.push({
			route: '/plugins/paypal-subscriptions',
			icon: 'fa-paypal',
			name: 'Paypal Subscriptions'
		});
	
		callback(null, header);
	};
    
    admin.getPaidJobs = function(callback) {
        
    };
    
    admin.getUnpaidJobs = function(callback) {
        
    };
    
	admin.getSettings = function(callback) {
		db.getObject('nodebb-plugin-paypal-subscriptions:settings', function(err, settings) {
			if (err) {
				return callback(err);
			}
			settings = settings || {};

			/*settings.collapseWhiteSpace = parseInt(settings.collapseWhiteSpace, 10) === 1;*/
			callback(null, settings);
		});
	};

	admin.saveSettings = function(data, callback) {
		settings.setting1 = data.setting1;
		settings.setting2 = data.setting2;
		db.setObject('nodebb-plugin-paypal-subscriptions:settings', settings, function(err) {
			if (err) {
				return callback(err);
			}
			pubsub.publish('nodebb-plugin-paypal-subscriptions:settings', settings);
			callback();
		});
	};

	function deleteSettings(callback) {
		callback = callback || function() {};
		db.delete('nodebb-plugin-paypal-subscriptions:settings', callback);
	}

	pubsub.on('nodebb-plugin-paypal-subscriptions:activate', function() {
		reStartCronJobs();
	});

	pubsub.on('nodebb-plugin-paypal-subscriptions:deactivate', function() {
		stopCronJobs();
	});

	pubsub.on('nodebb-plugin-paypal-subscriptions:settings', function(newSettings) {
		settings = newSettings;
	});

	admin.activate = function(id) {
		if (id === 'nodebb-plugin-paypal-subscriptions') {
			pubsub.publish('nodebb-plugin-paypal-subscriptions:activate');
		}
	};

	admin.deactivate = function(id) {
		if (id === 'nodebb-plugin-paypal-subscriptions') {
			pubsub.publish('nodebb-plugin-paypal-subscriptions:deactivate');
		}
	};

	admin.uninstall = function(id) {
		if (id === 'nodebb-plugin-paypal-subscriptions') {
			deleteSettings();
            subscriptions.deleteAllSubscriptionSettings();
            subscriptions.deleteUserSubscriptions();
		}
	};

	admin.getSettings(function(err, settingsData) {
		if (err) {
			return winston.error(err.message);
		}
		settings = settingsData;
	});
    
    admin.onGroupDestroyed = function(groupObj) {
        subscriptions.deleteUserSubscriptionsByName(groupObj.name);
        subscriptions.deleteSubscriptionSettingsByName(groupObj.name);
    }
    
    admin.onGroupRenamed = function(oldname,newname) {
        var newGroupsList = [];
        subscriptions.getAllSubscriptionSettings(function(err, groups) {
            /*No groups? Make a speedy exit*/
			if (err || !Array.isArray(groups)) {
				return;
			}
            
            groups.forEach(function(group) {
               /*switch the names*/
               if(group) {
                    if(group.name == oldgname){
                        group.name = newname;
                    }
               }               
            });
            
            newGroupsList = groups;
            plugins.fireHook('filter:nodebb-plugin-paypal-subscriptions.subscriptionsettingrenamed', {oldname: oldname,newname: newname});
		});
        /*Do we have any settings to go through at all?*/
        if(!newGroupsList || !newGroupsList.length){
            /*No? Then remove any jobs that exist*/
            subscriptions.deleteUserSubscriptions();
            return;
        }
        
        subscriptions.deleteAllSubscriptionSettings();
        
        subscriptions.setSubscriptionSettings(newGroupsList,function(){
            
           /*Same process on jobs*/
            var newJobsList = [];
            subscriptions.getUserSubscriptions(function(err, jobs) {
                /*No groups? Make a speedy exit*/
                if (err || !Array.isArray(jobs)) {
                    return;
                }
                
                jobs.forEach(function(job) {
                   /*switch the names*/
                   if(job) {
                        if(job.name == oldname){
                            job.name = newname;
                        }
                   }               
                });
                
                newJobsList = jobs;
            });
            if(!newJobsList || !newJobsList.length){
                /*No jobs to change? We can bail*/
                return;
            }
            
            subscriptions.deleteUserSubscriptions();
            
            subscriptions.addUserSubscriptions(newJobsList,null); 
        });
    }
    
    admin.onGroupUpdated = function(groupname,groupobject) {
        /*Fires after rename group...*/
    }
    
    admin.onUserJoinedGroup = function(groupname,uid){
        
    }
    
    admin.onUserLeftGroup = function(groupname,uid) {
        
    }

	module.admin = admin;

}(module.exports));
