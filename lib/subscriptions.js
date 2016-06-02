'use strict';

var NodeBB = module.require('./nodebb'),
    db = NodeBB.db,
    user = NodeBB.User,
    plugins = NodeBB.Plugins,
    async = NodeBB.async,
    groups = NodeBB.Groups,
    winston = NodeBB.winston;
/*Payment Module*/    
var payment = module.require('./payment');
    
var Subscriptions = {};
    /*Useful functions*/
	/*user.getUidByEmail(email, callback);*/
    /*user.isAdministrator(uid,callback);*/
    /*user.isModerator(uid,callback);*/
    /*user.isGlobalModerator(uid,callback);*/
    /*user.isAdminOrGlobalMod(uid,callback);*/
    
    /*Saving subscription settings*/
	Subscriptions.setSubscriptionSettings = function(settings, callback) {
		async.each(settings, function saveGroup(setting, next) {
            /*The setting needs a name and a group which it controls*/
			if(!setting.name || !setting.group) {
				return next();
			}
			async.parallel([
				function(next) {
					db.setObject('nodebb-plugin-paypal-subscriptions:subscription:' + setting.name, setting, next);
                    plugins.fireHook('filter:nodebb-plugin-paypal-subscriptions.subscriptionsettingsupdated', {subscriptionSettings: setting});
				},
				function(next) {
					db.setAdd('nodebb-plugin-paypal-subscriptions:subscriptions', setting.name, next);
				}
			], next);
		}, callback);
	}
    
    /*adds as many user subscription objects as pleased*/
    Subscriptions.getAllSubscriptionSettings = function(callback){
        db.getSetMembers('nodebb-plugin-paypal-subscriptions:subscriptions', function(err, settings) {
			if (err) {
				return callback(err);
			}

			async.map(settings, function (settingskey, next) {
				db.getObject('nodebb-plugin-paypal-subscriptions:subscription:' + settingskey, next);
			}, function(err, results) {
				if (err) {
					return callback(err);
				}
				results.forEach(function(setting) {
					if (setting) {
					  /*Assign the defaults on the backend*/
						/*feed.entriesToPull = feed.entriesToPull || 4;*/
						setting.cost = setting.cost || 5;
						setting.graceinterval = setting.graceinterval || 'weeks';
						setting.gracecount = setting.gracecount || 0;
						setting.trialinterval = setting.trialinterval || 'weeks';
						setting.trialcount = setting.trialcount || 0;
						setting.subscriptioninterval = setting.subscriptioninterval || 'months';
						setting.subscriptioncount = setting.subscriptioncount || 1;
						setting.endbehavior = setting.endbehavior || 'blocked';
					}
				});

				callback(null, results ? results : []);
			});
		});
    };
    
    Subscriptions.addUserSubscriptions = function(usersubscriptions, callback) {
        /*Get our subscription settings*/
        var settings = [];
        Subscriptions.getAllSubscriptionSettings(function(err, subscriptionsettings) {
            /*No groups? Make a speedy exit*/
			if (err || !Array.isArray(subscriptionsettings)) {
				return;
			}
            settings = subscriptionsettings;
		});
        
		async.each(usersubscriptions, function saveJobs(usersubscription, next) {
            /*making sure we only save jobs which have the bare minimum to function*/
			if(!usersubscription || !usersubscription.uid || !usersubscription.name || !usersubscription.status) {
				return next();
			} else {
                /*We take into account the usersubscription settings here*/
                var subscriptionSetting = settings.filter(function(setting) {
                    return setting && setting.name == usersubscription.name;
                });
                /*Set the join date or leave it alone for assigned values*/
                usersubscription.joinDate = usersubscription.joinDate || Date.now();
                
                /*Set trial expiration date*/
                usersubscription.trialPeriodExpirationDate = usersubscription.joinDate || usersubscription.joinDate;
                if(Subscriptions.hasTrialPeriod(subscriptionSetting)){
                    usersubscription.trialPeriodExpirationDate = offsetDate(usersubscription.trialPeriodExpirationDate,subscriptionSetting.trialinterval,subscriptionSetting.trialcount);
                    /*with a trial period we can't be sure of the last date paid*/
                } else {
                    /*without a trial period the user shouldn't have been able to join, w/o paying first*/
                    usersubscription.lastPaidDate = usersubscription.joinDate;
                }
                
                /*Set the usersubscription expiration date*/
                usersubscription.subscriptionPeriodExpirationDate = usersubscription.subscriptionPeriodExpirationDate || usersubscription.trialPeriodExpirationDate;
                if(Subscriptions.hasSubscriptionPeriod(subscriptionSetting)){
                    usersubscription.subscriptionPeriodExpirationDate = offsetDate(usersubscription.subscriptionPeriodExpirationDate,subscriptionSetting.subscriptioninterval,subscriptionSetting.subscriptioncount);
                }
                
                /*Set the grace expiration date*/
                usersubscription.gracePeriodExpirationDate = usersubscription.gracePeriodExpirationDate || usersubscription.subscriptionPeriodExpirationDate;
                if(Subscriptions.hasGracePeriod(subscriptionSetting)){
                    usersubscription.gracePeriodExpirationDate = offsetDate(usersubscription.gracePeriodExpirationDate,subscriptionSetting.graceinterval,subscriptionSetting.gracecount);
                }
            }
            
			async.parallel([
				function(next) {
                    /*should be* a unique key! usersubscription.uid+'-'usersubscription.name*/
					db.setObject('nodebb-plugin-paypal-subscriptions:usersubscription:' + usersubscription.uid + '-' + usersubscription.name, usersubscription, next);
				},
				function(next) {
                    /*Add to a list*/
					db.setAdd('nodebb-plugin-paypal-subscriptions:usersubscriptions', usersubscription.uid + '-' + usersubscription.name, next);
				}
			], next);
		}, callback);
	}
    
    Subscriptions.deleteAllSubscriptionSettings = function(callback) {
		callback = callback || function() {};
		db.getSetMembers('nodebb-plugin-paypal-subscriptions:subscriptions', function(err, subscriptions) {
			if (err || !subscriptions || !subscriptions.length) {
				return callback(err);
			}

			async.each(subscriptions, function(key, next) {
				async.parallel([
					function(next) {
						db.delete('nodebb-plugin-paypal-subscriptions:subscription:' + key, next);
					},
					function(next) {
						db.setRemove('nodebb-plugin-paypal-subscriptions:subscriptions', key, next);
					}
				], next);
			}, callback);
		});
	}
    
    Subscriptions.deleteSubscriptionSettingsByName = function(name,callback) {
        callback = callback || function() {};
		db.getSetMembers('nodebb-plugin-paypal-subscriptions:subscriptions', function(err, subscriptions) {
			if (err || !subscriptions || !subscriptions.length) {
				return callback(err);
			}
            /*Filter out the subscriptions with the wrong name*/
            subscriptions = subscriptions.filter(function(subscription){
               return subscription && subscription.name == name; 
            });
            
			async.each(subscriptions, function(key, next) {
				async.parallel([
					function(next) {
						db.delete('nodebb-plugin-paypal-subscriptions:subscription:' + key, next);
					},
					function(next) {
						db.setRemove('nodebb-plugin-paypal-subscriptions:subscriptions', key, next);
					}
				], next);
			}, callback);
            
            /*plugins.fireHook('filter:nodebb-plugin-paypal-subscriptions.subscriptiongroupdeleted', {groupname: groupname});*/
		});
    }
    
    Subscriptions.getUserSubscriptions = function(callback) {
        db.getSetMembers('nodebb-plugin-paypal-subscriptions:usersubscriptions', function(err, subscriptionKey) {
			if (err) {
				return callback(err);
			}

			async.map(subscriptionKey, function (groupName, next) {
				db.getObject('nodebb-plugin-paypal-subscriptions:usersubscription:' + subscriptionKey, next);
			}, function(err, results) {
				if (err) {
					return callback(err);
				}
                /*default status for any *new* user is paid*/
				results.forEach(function(userSubscription) {
					if (userSubscription) {
                        /*Assign the defaults on the backend*/
                        userSubscription.status = userSubscription.status || 'paid';
					}
				});

				callback(null, results ? results : []);
			});
		});
    }
    
    /*Call to grab a single setting*/
    Subscriptions.getSubscriptionSettingByName = function(subscriptionname){
        db.getObject('nodebb-plugin-paypal-subscriptions:subscription:' + subscriptionname, function(err, settings) {
			callback(err, settings || {});
		});
    }
    /*Wrapper when handling a usersubscription object*/
    Subscriptions.getUsersSubscriptionSettings = function(userSubscription,callback){
        Subscriptions.getSubscriptionSettingByName(userSubscription.name,callback);
    }
    
    /*theoretically, should never be called except on uninstall, would reset all users to the default state*/
    Subscriptions.deleteUserSubscriptions = function(callback) {
		callback = callback || function() {};
		db.getSetMembers('nodebb-plugin-paypal-subscriptions:usersubscriptions', function(err, usersubscriptions) {
			if (err || !usersubscriptions || !usersubscriptions.length) {
				return callback(err);
			}

			async.each(usersubscriptions, function(key, next) {
				async.parallel([
					function(next) {
						db.delete('nodebb-plugin-paypal-subscriptions:usersubscription:' + key, next);
					},
					function(next) {
						db.setRemove('nodebb-plugin-paypal-subscriptions:usersubscriptions', key, next);
					}
				], next);
			}, callback);
		});
	}

    Subscriptions.deleteUserSubscriptionsByName = function(name,callback) {
		callback = callback || function() {};
		db.getSetMembers('nodebb-plugin-paypal-subscriptions:usersubscriptions', function(err, usersubscriptions) {
			if (err || !usersubscriptions || !usersubscriptions.length) {
				return callback(err);
			}
            
            usersubscriptions = usersubscriptions.filter(function(usersubscription) {
                return usersubscription && usersubscription.name == name;
            });

			async.each(usersubscriptions, function(key, next) {
				async.parallel([
					function(next) {
						db.delete('nodebb-plugin-paypal-subscriptions:usersubscription:' + key, next);
					},
					function(next) {
						db.setRemove('nodebb-plugin-paypal-subscriptions:usersubscriptions', key, next);
					}
				], next);
			}, callback);
		});
	}
    
    Subscriptions.getUserSubscription = function(uid,subscriptionname,callback){
        db.getObject('nodebb-plugin-paypal-subscriptions:usersubscription:' + uid + '-' + subscriptionname, function(err, settings) {
			callback(err, settings || {});
		});
    }
    
    Subscriptions.isInTrialPeriod = function(usersubscription){
        var today = Date.now();
        return today >= usersubscription.joinDate && today <= usersubscription.trialPeriodExpirationDate;
    }
    
    Subscriptions.isInGracePeriod = function(usersubscription){
        var today = Date.now();
        return today >= usersubscription.subscriptionPeriodExpirationDate && today <= usersubscription.gracePeriodExpirationDate;
    }
    
    Subscriptions.isInTrialPeriodOrPaid = function(usersubscription){
        return Subscriptions.isInTrialPeriod(usersubscription) || Subscriptions.isPaid(usersubscription);
    }
    
    Subscriptions.shouldUserBeInGroup = function(usersubscription){
        return Date.now() <= usersubscription.gracePeriodExpirationDate;
    }
    
    Subscriptions.checkOnSubscriber = function(usersubscription,callback){
        var subscriptionSetting = null;
        Subscriptions.getUsersSubscriptionSettings(usersubscription,function(err,setting){
            if(err){
                return;
            }
            subscriptionSetting = setting;
        });
        if(!subscriptionSetting){
            return;
        }
        if(Subscriptions.shouldUserBeInGroup(usersubscription)){
            async.parallel([
                function(callback) {
                    /*Make sure sure is in group*/
                    groups.join(subscriptionSetting.group,usersubscription.uid,callback);
                }
            ], callback);
        } else {
            async.parallel([
                function(callback) {
                    /*Make sure sure is in group*/
                    groups.kick(subscriptionSetting.group,usersubscription.uid,callback);
                }
            ], callback);
        }
    }
    
    Subscriptions.hasUserUsedTrial = function(usersubscription){
        return usersubscription && usersubscription.isTrialExpired;
    }
    
    Subscriptions.hasTrialPeriod = function(subscriptionsetting){
        return subscriptionsetting && subscriptionsetting.trialinterval && subscriptionsetting.trialcount > 0;
    }
    
    Subscriptions.hasGracePeriod = function(subscriptionsetting){
        return subscriptionsetting && subscriptionsetting.graceinterval && subscriptionsetting.gracecount > 0;
    }
    
    /*Technically...this should return always true...but we'll test it anyway*/
    Subscriptions.hasSubscriptionPeriod = function(subscriptionsetting){
        return subscriptionsetting && subscriptionsetting.subscriptioninterval && subscriptionsetting.subscriptioncount > 0;
    }
    
    /*Should push new dates forward if already in paid status*/
    Subscriptions.onSuccessfulPayment = function(usersubscription,callback){
        var subscriptionSetting = null;
        Subscriptions.getUsersSubscriptionSettings(usersubscription,function(err,setting){
            if(err){
                /*error out*/
                return;
            }
            subscriptionSetting = setting;
        });
        if(!subscriptionSetting){
            /*error out*/
            return;
        }
        
        usersubscription.lastPaidDate = Date.now();
        
        if(usersubscription.status == 'paid'){
            usersubscription.trialPeriodExpirationDate = usersubscription.gracePeriodExpirationDate; /*gracePeriodExpirationDate is the always the last date, hence we rotate from here*/
            /*Set the usersubscription expiration date*/
            usersubscription.subscriptionPeriodExpirationDate = usersubscription.trialPeriodExpirationDate;
            if(Subscriptions.hasSubscriptionPeriod(subscriptionSetting)){
                usersubscription.subscriptionPeriodExpirationDate = offsetDate(usersubscription.subscriptionPeriodExpirationDate,subscriptionSetting.subscriptioninterval,subscriptionSetting.subscriptioncount);
            }
            
            /*Set the grace expiration date*/
            usersubscription.gracePeriodExpirationDate = usersubscription.gracePeriodExpirationDate || usersubscription.subscriptionPeriodExpirationDate;
            if(Subscriptions.hasGracePeriod(subscriptionSetting)){
                usersubscription.gracePeriodExpirationDate = offsetDate(usersubscription.gracePeriodExpirationDate,subscriptionSetting.graceinterval,subscriptionSetting.gracecount);
            }
        }else{
            /*Disable pesky payment notifications*/
        }
        usersubscription.status = 'paid';
        
        async.parallel([
            function(callback) {
                /*should be* a unique key! usersubscription.uid+'-'usersubscription.name*/
                db.setObject('nodebb-plugin-paypal-subscriptions:usersubscription:' + usersubscription.uid + '-' + usersubscription.name, usersubscription, callback);
            },
            function(callback) {
                /*Add to a list*/
                db.setAdd('nodebb-plugin-paypal-subscriptions:usersubscriptions', usersubscription.uid + '-' + usersubscription.name, callback);
            },
            function(callback) {
                /*Make sure sure is in group*/
                groups.join(subscriptionSetting.group,usersubscription.uid,callback);
            }
        ], callback);
        
        plugins.fireHook('filter:nodebb-plugin-paypal-subscriptions.onsuccessfulpayment', {usersubscription : usersubscription });
    }
    
    Subscriptions.onTrialPeriodExpired = function(usersubscription,callback){
        setSubscriptionJobField(usersubscription,'isTrialExpired',true,callback);
        
        plugins.fireHook('filter:nodebb-plugin-paypal-subscriptions.ontrialperiodexpired', {usersubscription : usersubscription });
    }
    
    Subscriptions.onSubscriptionExpired = function(usersubscription,callback){
        var subscriptionSetting;
        Subscriptions.getUsersSubscriptionSettings(usersubscription,function(err,setting){
            if(err){
                return;
            }
            subscriptionSetting = setting;
        });
        
        if(Subscriptions.hasGracePeriod(subscriptionSetting)){
            
        } else {
            /*Kick*/
            async.parallel([
                function(callback) {
                    /*Make sure sure is in group*/
                    groups.join(subscriptionSetting.group,usersubscription.uid,callback);
                }
            ], callback);    
        }
        
        plugins.fireHook('filter:nodebb-plugin-paypal-subscriptions.onexpired', {usersubscription : usersubscription });
    }
    
    Subscriptions.onGracePeriodExpired = function(usersubscription,callback){
        setSubscriptionJobField(usersubscription,'isGracePeriodExpired',true,callback);
        
        var subscriptionSetting;
        Subscriptions.getUsersSubscriptionSettings(usersubscription,function(err,setting){
            if(err){
                return;
            }
            subscriptionSetting = setting;
        });
        /*Remove the subscription*/
        if(usersubscription.status == 'unpaid'){
            async.parallel([
                function(next) {
                    db.delete('nodebb-plugin-paypal-subscriptions:usersubscription:' + usersubscription.uid + '-' + usersubscription.name, next);
                },
                function(next) {
                    db.setRemove('nodebb-plugin-paypal-subscriptions:usersubscriptions', usersubscription.uid + '-' + usersubscription.name, next);
                },
                function(callback) {
                    /*Make sure sure is out of group*/
                    groups.kick(subscriptionSetting.group,usersubscription.uid,callback);
                }
            ], callback);
        }
        plugins.fireHook('filter:nodebb-plugin-paypal-subscriptions.ongraceperiodexpired', {usersubscription : usersubscription });
    }
    
    function offsetDate(timeObject,interval,count){
        var tempTimeObject = timeObject;
        if(interval == "minute"){
            tempTimeObject.setMinutes(tempTimeObject.getMinutes()+count);
        } else if (interval == "hour"){
            tempTimeObject.setHours(tempTimeObject.getHours()+count);
        } else if (interval == "day"){
            tempTimeObject.setMinutes(tempTimeObject.getMinutes()+(count*86400));
        } else if (interval == "week"){
            tempTimeObject.setMinutes(tempTimeObject.getMinutes()+(count*86400*7));                        
        } else if (interval == "month"){
            tempTimeObject.setMonth(tempTimeObject.getMonth()+count);   
        } else if (interval == "year"){
            tempTimeObject.setYear(tempTimeObject.getYear()+count);  
        }
        return tempTimeObject;
    }
    
    function offsetNow(interval,count){
        return offsetDate(Date.now(),interval,count);
    }
    
    function setUserSubscriptionField(userSubscription,fieldName,value,callback){
        db.setObjectField('nodebb-plugin-paypal-subscriptions:usersubscription:' + userSubscription.uid+'-'+userSubscription.name, fieldName, value, callback);
    }
    
    function setUserSubscription(userSubscription,callback){
        db.setObject('nodebb-plugin-paypal-subscriptions:usersubscription:' + userSubscription.uid+'-'+userSubscription.name, userSubscription, callback);
    }
    
	/*something like this: performs initial setup over again*/
	function giveUserTrialMembership(uid,subscriptionName,trialinterval,triallength){
		/*add user to group*/ 
		/*queue up job to remove the user from that group trialinterval x triallength from now*/
		/*...there's a few cron jobs which should ping at every interval...*/
		/*...add job revokeUserSubscription(user,group);*/
        
	}
	
	function extendTrialPeriod(uid,subscriptionName,trialinterval,triallength){
		/*double check the user's trial period in the subscription is less than the one the admin will give*/
		
		/*remove the user's previous trial period*/
		
		/*replace the grace trial with the new one*/
	}
	
	function giveUserGracePeriod(uid,subscriptionName,graceinterval,gracelength){
		/*at the end of a subscription, this function will be called, if there is no grace period to give the user will be removed instantly*/
	}
	
	/*For admins who'd like to be nice I'd imagine there'd be a button to do this*/
	function extendGracePeriod(uid,subscriptionName,graceinterval,gracelength){
		/*double check the user's grace period in the subscription is less than the one the admin will give*/
		
		/*remove the user's previous grace period*/
		
		/*replace the grace period with the new one*/
	}
	
	function giveUserSubscription(uid,subscriptionName,options){
		/*add user to group*/
		/*remove all trial and grace periods*/
        var userSubscription = {
            uid: uid,
            name: subscriptionName,
            status: options.status || 'paid',
            joinDate: options.joinDate || Date.now(),
            lastPaidDate: options.lastPaidDate || Date.now()
        };
        Subscriptions.addUserSubscriptions(userSubscription,null);
	}
	function revokeUserSubscription(uid,subscriptionName){
		/*remove user from group*/
	}

module.exports = Subscriptions;