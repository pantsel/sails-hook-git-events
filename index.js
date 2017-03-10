'use strict';

var child_process = require('child_process');
var spawn = child_process.spawn
var isWin = /^win/.test(process.platform);
var path = require('path')
var socketIOClient = require('socket.io-client');
var sailsIOClient = require('sails.io.js');
var working = false;


module.exports = function gitUpdateHook(sails) {
    return {

        defaults: {
            __configKey__: {
                timeout: 5000,
                apiKey : "RMPa2520ER2t50CE8JRI27tQ9ujS54BH",
                repoName : "test-repo-name",
                socketServerUrl : "http://localhost:1337"
            }
        },

        configure: function() {
            // ToDo
        },

        /**
         * @param {Function}  next  Callback function to call after all is done
         */
        process: function(next) {

            sails.log("Hook:git-events => Init")

            var self = this;
            var io = sailsIOClient(socketIOClient);
            io.sails.autoConnect = false
            io.sails.initialConnectionHeaders = {
                apikey : sails.config[self.configKey].apiKey
            }

            var repo = sails.config[self.configKey].repoName; // taken from the main projects package.json
            var url =  sails.config[self.configKey].socketServerUrl
            var socket = io.sails.connect(url,{
                reconnection: true,
                reconnectionDelay: 1000,
                reconnectionDelayMax : 5000,
                reconnectionAttempts: Infinity
            })

            /**
             * Function that handles git webHooks socket events
             * @param data
             */
            var handlerFn = function(data){
                sails.log("Hook:git-events => on event",data)
                sails.emit('git-event',data)
            }

            socket.on('connect', function(){
                sails.log("Socket connected to git webHooks server")
                socket.get('/subscribe?repo=' + repo, function serverResponded (data, jwr) {
                    if (jwr.statusCode == 200){
                        socket.on(repo,handlerFn);
                    }
                });
            })

            socket.on('disconnect', function(){
                sails.log("Hook:git-events:socket disconnected")
                socket.off(repo,handlerFn); // Remove repo listener
            })

          next()
        },

        /**
         * Method that runs automatically when the hook initializes itself.
         *
         * @param {Function}  next  Callback function to call after all is done
         */
        initialize: function initialize(next) {
            var self = this;

            // Wait for sails orm hook to be loaded
            var eventsToWaitFor = ['hook:sockets:loaded'];
            sails.after(eventsToWaitFor, function onAfter() {
                self.process(next);
            });
        }
    };
};