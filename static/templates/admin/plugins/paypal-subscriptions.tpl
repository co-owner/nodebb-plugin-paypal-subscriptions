<form role="form" class="quickstart-settings">
	<div class="row">
		<div class="col-sm-2 col-xs-12 settings-header">General</div>
		<div class="col-sm-10 col-xs-12">
			<p class="lead">
				Adjust these settings. You can then retrieve these settings in code via:
				<code>meta.settings.get('quickstart');</code>
			</p>
			<div class="form-group">
				<label for="setting-1">Default Subscription Type</label>
				<input type="text" id="setting-1" name="setting-1" title="Setting 1" class="form-control" placeholder="Setting 1">
			</div>
			<div class="form-group">
				<label for="setting-2">Default Renewal Price</label>
				<input type="text" id="setting-2" name="setting-2" title="Setting 2" class="form-control" placeholder="Setting 2">
			</div>
		</div>
	</div>
</form>

<div class="form groups">
<!-- IMPORT partials/groups.tpl -->
</div>

<button id="addSubscription" class="mdl-button mdl-js-button mdl-button--fab mdl-js-ripple-effect mdl-button--colored">
	<i class="material-icons">add box</i>
</button>

<button id="save" class="floating-button mdl-button mdl-js-button mdl-button--fab mdl-js-ripple-effect mdl-button--colored">
	<i class="material-icons">save</i>
</button>

<input id="csrf_token" type="hidden" value="{csrf}" />

<script src="{config.relative_path}/vendor/jquery/bootstrap-tagsinput/bootstrap-tagsinput.min.js"></script>
<script type="text/javascript">
	$(document).ready(function() {
		var groupList = null;
		
		function addOptionsToAllSelects() {
			$('.form-control.subscription-group').each(function(index, element) {
				addOptionsToSelect($(element));
			});
		}
		
		function addOptionsToSelect(select) {
			if(groupList == null){
				console.log("groupList is null?");
			} else {
				for(var i=0; i<groupList.length; ++i) {
					/*Probably the structure of the groups object...apologies...wild guess these are the accessors needed*/
					select.append('<option value=' + groupList[i].name + '>' + groupList[i].name + '</option>');
				}
			}
		}
		socket.emit('groups.search', function(err, data) {
			groupList = data;
			console.log(groupList);
			if(err){
				console.log(err);
			}
			addOptionsToAllSelects();
			/*Filling the options back in?*/
			$('.subscription-interval').each(function(index, element) {
				$(element).val($(element).attr('data-interval'));
			});

			$('.subscription-grace-interval').each(function(index,element) {
				$(element).val($(element).attr('data-interval'));
			});

			$('.subscription-group').each(function(index, element) {
				$(element).val($(element).attr('data-group'));
			});
		});
		$('#addSubscription').on('click', function() {
			ajaxify.loadTemplate('partials/groups', function(groupTemplate) {
				var tempBlock = templates.getBlock(groupTemplate, 'groups');
				/*filling in the defaults*/
				var html = templates.parse(tempBlock, {
					groups: [{
						name: '',
						group: '',
						username: '',
						cost: 5,
						graceinterval: 'weeks',
						gracecount: 0,
						trialinterval: 'weeks',
						trialcount: 0,
						interval: 'months',
						count: 1,
						endbehavior: 'blocked'
					}]
				});

				var newGroup = $(html).appendTo('.groups');
				enableAutoComplete(newGroup.find('.subscription-admin'));
				/*enableTagsInput(newFeed.find('.feed-tags'));*/
				addOptionsToSelect(newGroup.find('.subscription-group'));
			});
			return false;
		});
		$('.groups').on('click', '.remove', function() {
			$(this).parents('.group').remove();
			return false;
		});
		$('#save').on('click', function() {
			var groupsToSave = [];
			$('.group').each(function(index, child) {
				child = $(child);
				var groupItem = {
					name: child.find('.subscription-name').val(),
					group: child.find('.subscription-group').val(),
					username: child.find('.subscription-username').val(),
					cost: child.find('.subscription-cost').val(),
					graceinterval: child.find('.subscription-grace-interval').val(),
					gracecount: child.find('.subscription-grace-count').val(),
					trialinterval: child.find('.subscription-trial-interval').val(),
					trialcount: child.find('.subscription-trial-count').val(),
					interval: child.find('.subscription-interval').val(),
					count: child.find('.subscription-count').val(),
					endBehavior: child.find('.subscription-end-behavior').val()
				};
				/*Must haves~before we save anything...*/
                console.log(groupItem);
				if (groupItem.name && groupItem.group) {
					groupsToSave.push(groupItem);
				} else {
                    
                }
			});
            console.log(groupsToSave);
			$.post('{config.relative_path}/api/admin/plugins/paypal-subscriptions/save', {
				_csrf: $('#csrf_token').val(),
				groups: groupsToSave,
				settings: {
					setting1: $('#setting-1').val(),
					setting2: $('#setting-2').val()
				}
			}, function(data) {
				app.alert({
					title: 'Success',
					message: data.message,
					type: 'success',
					timeout: 2000
				});
			});
			return false;
		});
		function enableAutoComplete(selector) {
			selector.autocomplete({
				source: function(request, response) {
					socket.emit('admin.user.search', {query: request.term}, function(err, results) {
						if (err) {
							return app.alertError(err.message)
						}
						if (results && results.users) {
							var users = results.users.map(function(user) { return user.username });
							response(users);
							$('.ui-autocomplete a').attr('href', '#');
						}
					});
				}
			});
		}
		function enableTagsInput(selector) {
			selector.tagsinput({
				maxTags: config.tagsPerTopic,
				confirmKeys: [13, 44]
			});
		}
		enableAutoComplete($('.groups .subscription-admin'));
		/*enableTagsInput($('.feeds .feed-tags'));*/
	});
</script>
