<!-- BEGIN groups -->
<div class="row group well">
		<div class="col-sm-12 col-xs-12">
			<div class="form-group">
				<label>Subscription Name</label>
				<input type="text" class="form-control subscription-name" placeholder="Enter the subscription's name" value="{groups.name}">
			</div>
		</div>
		<br/>
		<div class="clearfix">
			<div class="col-sm-3 col-xs-12">
				<div class="form-group">
					<label>Group To Control</label>
					<select class="form-control subscription-group" data-group="{groups.group}">

					</select>
				</div>
			</div>
			<div class="col-sm-2 col-xs-12">
				<div class="form-group">
	  				<label>Grace Interval</label>
	  				<select class="form-control subscription-grace-interval" data-interval="{groups.graceinterval}">
						<option value="minute">Minutes</option>
						<option value="hour">Hours</option>
						<option value="day">Days</option>
						<option value="week">Weeks</option>
						<option value="month">Months</option>
						<option value="year">Years</option>
	  				</select>
				</div>
			</div>
	  		<div class="col-sm-2 col-xs-12">
	  			<div class="form-group">
	  				<label>Count</label>
	  				<input type="text" class="form-control subscription-grace-count" placeholder="How long does the grace period last?" value="{groups.gracecount}">
	  			</div>
	  		</div>
			<div class="col-sm-2 col-xs-12">
				<div class="form-group">
					<label>Trial Interval</label>
					<select class="form-control subscription-trial-interval" data-interval="{groups.trialinterval}">
						<option value="minute">Minutes</option>
						<option value="hour">Hours</option>
						<option value="day">Days</option>
						<option value="week">Weeks</option>
						<option value="month">Months</option>
						<option value="year">Years</option>
					</select>
				</div>
			</div>
			<div class="col-sm-2 col-xs-12">
				<div class="form-group">
					<label>Count</label>
					<input type="text" class="form-control subscription-trial-count" placeholder="How long does the trial period last?" value="{groups.trialcount}">
				</div>
			</div>
		</div>

		
		<div class="col-sm-2 col-xs-12">
			<div class="form-group">
				<label>User</label>
				<input type="text" class="form-control subscription-admin" placeholder="User to control group as" value="{groups.username}">
			</div>
		</div>
		
		
		<div class="col-sm-2 col-xs-12">
			<div class="form-group">
				<label>Pay</label>
				<input type="text" class="form-control subscription-cost" placeholder="Renewal cost of subscription" value="{groups.cost}">
			</div>
		</div>

		<div class="col-sm-2 col-xs-12">
			<div class="form-group">
				<label>Subscription Interval</label>
				<select class="form-control subscription-interval" data-interval="{groups.subscriptioninterval}">
				  <option value="minute">Minutes</option>
					<option value="hour">Hours</option>
					<option value="day">Days</option>
					<option value="week">Weeks</option>
					<option value="month">Months</option>
					<option value="year">Years</option>
				</select>
			</div>
		</div>

		<div class="col-sm-2 col-xs-12">
			<div class="form-group">
				<label>Count</label>
				<input type="text" class="form-control subscription-count" placeholder="How many payment intervals does a subscription last?" value="{groups.subscriptioncount}">
			</div>
		</div>

		<div class="col-sm-3 col-xs-12">
			<div class="form-group">
				<label>Removal Behvaior</label>
				<select class="form-control subscription-end-behavior" data-endbehavior="{groups.endbehavior}">
					<option value="blocked">Removed Until Paid</option>
					<option value="grace">Grace Period</option>
				</select>
			</div>
		</div>
        
        <div class="col-sm-3 col-xs-12">
			<div class="form-group checkbox">
                <label>
                    <input class="form-control subscription-ignore-admins" type="checkbox" <!-- IF groups.ignoreAdmins -->checked<!-- ENDIF groups.ignoreAdmins -->> Ignore Admins
                </label>
			</div>
		</div>
        
        <div class="col-sm-3 col-xs-12">
			<div class="form-group checkbox">
                <label>
                    <input class="form-control subscription-ignore-moderators" type="checkbox" <!-- IF groups.ignoreModerators -->checked<!-- ENDIF groups.ignoreModerators -->> Moderators
                </label>
			</div>
		</div>
        
        <div class="col-sm-3 col-xs-12">
			<div class="form-group checkbox">
                <label>
                    <input class="form-control subscription-ignore-group-owner" type="checkbox" <!-- IF groups.ignoreGroupOwner -->checked<!-- ENDIF groups.ignoreGroupOwner -->> Group Owner
                </label>
			</div>
		</div>

		<div class="col-sm-3 col-xs-12">
			<div class="form-group">
				<label>&nbsp;</label>
				<button class="form-control remove btn-warning">Remove</button>
			</div>
		</div>
</div>
<!-- END groups -->
