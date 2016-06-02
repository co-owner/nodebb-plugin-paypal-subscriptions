"use strict";

(function(NodeBB) {
	module.exports = {
        Settings: NodeBB.require('./src/settings'),
        Meta: NodeBB.require('./src/meta'),
        User: NodeBB.require('./src/user'),
        Plugins: NodeBB.require('./src/plugins'),
        db: NodeBB.require('./src/database'),
        winston: NodeBB.require('winston'),
        async: NodeBB.require('async')
	}
})(require.main);