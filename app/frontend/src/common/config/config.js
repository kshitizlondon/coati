(function () {
    "use strict";
    /**
     * Define the global configuration parameters
     * @returns {{getItem: getItem, $get: $get}}
     * @constructor
     */
    function KoalaGlobalConfiguration() {

        var globals = {
            BASE_API_URL: '/api',
            DEFAULT_CONTENT_TYPE: 'application/json; charset=utf-8'
        };
        return {
            getItem: function (key) {
                return globals[key];
            },
            $get: function () {
                return globals;
            }
        };
    }

//angular module
    angular.module('Koala.Config', []).provider('koalaConf', KoalaGlobalConfiguration);
}());