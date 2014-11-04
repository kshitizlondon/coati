(function () {

    /**
     * Configuration module users
     * @param stateProvider
     * @constructor
     */
    function ConfigModule(stateProvider) {
        stateProvider.state('profile', {
            url: '/profile/me/',
            views: {
                "main": {
                    controller: 'UserProfileCtrl',
                    templateUrl: 'user/user.tpl.html'
                }
            },
            data: {
                pageTitle: 'User Profile'
            }
        });
    }

    function UserProfileController(rootScope, scope, UserService) {

        rootScope.$watch('userGlobal', function (user) {
            if (user != null) {
                scope.user = rootScope.userGlobal;
                if (scope.user.profile && scope.user.profile.picture !== '') {
                    scope.image = {
                        resized: {
                            dataURL: scope.user.profile.picture
                        }
                    };
                }
                scope.alerts = [];
                scope.closeAlert = function (index) {
                    scope.alerts.splice(index, 1);
                };
                scope.save = function (image, form) {
                    scope.user.profile = {
                        id: scope.user.id,
                        picture: image ? image.resized.dataURL : ''
                    };
                    scope.alerts = [];
                    UserService.save(scope.user).then(function (data) {
                        console.log('USER UPDATED');
                    });
                };
            }
        });

    }

    function UserController(rootScope, scope, state, UserService) {
        UserService.me().then(function (user_data) {
            rootScope.userGlobal = user_data;
        }, function (data) {
            if (data.code == 404) {
                state.go('not_found');
            }
        });
    }

    ConfigModule.$inject = ['$stateProvider'];
    UserController.$inject = ['$rootScope', '$scope', '$state', 'UserService'];
    UserProfileController.$inject = ['$rootScope', '$scope', 'UserService'];

    angular.module('KoalaApp.User', ['ui.router',
        'KoalaApp.Directives',
        'KoalaApp.ApiServices'])
        .config(ConfigModule)
        .controller('UserCtrl', UserController)
        .controller('UserProfileCtrl', UserProfileController);

}());

