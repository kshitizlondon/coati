(function (angular) {

    var socket_module = function (rootScope, Conf) {
        var socket;
        if (typeof io !== 'undefined') {
            socket = io.connect(Conf.SOCKET_URL);

            return {
                on: function (eventName, callback) {
                    socket.on(eventName, function () {
                        var args;
                        args = arguments;
                        $rootScope.$apply(function () {
                            callback.apply(socket, args);
                        });
                    });
                },
                emit: function (eventName, data, callback) {
                    socket.emit(eventName, data, function () {
                        var args;
                        args = arguments;
                        $rootScope.$apply(function () {
                            if (callback) {
                                callback.apply(socket, args);
                            }
                        });
                    });
                }
            };
        } else {
            return undefined;
        }
    };

    socket_module.$inject = ['$rootScope', 'Conf'];

    angular.module('Coati.SocketIO', ['Coati.Config'])
        .factory('$socket', socket_module);

}(angular));

