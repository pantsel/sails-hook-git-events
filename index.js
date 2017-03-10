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

        git : {
            /**
             * Function that performs git pull
             * -------------------------------
             * Update repo and print messages. When there are changes, restart the app
             */
            pull : function() {
                require('simple-git')()
                  .then(function() {
                      sails.log('Hook:git-events => Starting pull...');
                  })
                  .pull(function(err, update) {
                      sails.log("Hook:git-events => pull results:",update)
                      working = false
                      if(update && update.summary.changes) {
                          sails.log("Hook:git-events => Restarting app")
                          var cmd = spawn('npm' + ( isWin ? '.cmd' : '' ),
                              [
                                  "restart"
                              ],
                              {cwd: process.cwd() ,stdio: "inherit"});
                          cmd.on('exit', function(code){
                              sails.log(code);
                          });
                      }
                  })
                  .then(function() {
                      sails.log('Hook:git-events => pull done.');
                      working = false
                  });
          }
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
                //if(!working && data.event && data.event == 'tag-push') {
                //    switch (data.event) {
                //        case "push":
                //            break;
                //        case "tag-push":
                //            self.git.pull()
                //            break;
                //        case "comments":
                //            break;
                //        case "issues":
                //            break;
                //        case "merge-request":
                //            break;
                //        default:
                //            sails.log("Default event")
                //    }
                //}
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
            var eventsToWaitFor = ['hook:orm:loaded'];
            sails.after(eventsToWaitFor, function onAfter() {
                self.process(next);
            });
        }
    };
};