(function (angular) {

    var ImageFunction = function (wnd, q) {
        'use strict';
        var URL, createImage, getResizeArea, resizeImage;
        URL = wnd.URL || wnd.webkitURL;
        getResizeArea = function () {
            var resizeArea, resizeAreaId;
            resizeAreaId = 'fileupload-resize-area';
            resizeArea = document.getElementById(resizeAreaId);
            if (!resizeArea) {
                resizeArea = document.createElement('canvas');
                resizeArea.id = resizeAreaId;
                resizeArea.style.visibility = 'hidden';
                document.body.appendChild(resizeArea);
            }
            return resizeArea;
        };
        resizeImage = function (origImage, options) {
            var canvas, ctx, height, maxHeight, maxWidth, quality, type, width;
            maxHeight = options.resizeMaxHeight || 300;
            maxWidth = options.resizeMaxWidth || 250;
            quality = options.resizeQuality || 0.7;
            type = options.resizeType || 'image/jpg';
            canvas = getResizeArea();
            height = origImage.height;
            width = origImage.width;
            if (width > height) {
                if (width > maxWidth) {
                    height = Math.round(height *= maxWidth / width);
                    width = maxWidth;
                }
            } else {
                if (height > maxHeight) {
                    width = Math.round(width *= maxHeight / height);
                    height = maxHeight;
                }
            }
            canvas.width = width;
            canvas.height = height;
            ctx = canvas.getContext('2d');
            ctx.drawImage(origImage, 0, 0, width, height);
            return canvas.toDataURL(type, parseFloat(quality));
        };
        createImage = function (url, callback) {
            var image = new Image();
            image.onload = function () {
                callback(image);
            };
            image.src = url;
        };
        return {
            restrict: 'A',
            scope: {
                image: '=',
                resizeMaxHeight: '@?',
                resizeMaxWidth: '@?',
                resizeQuality: '@?',
                resizeType: '@?'
            },
            link: function (scope, element, attrs) {
                var applyScope, doResizing, fileToDataURL;
                doResizing = function (imageResult, callback) {
                    createImage(imageResult.url, function (image) {
                        var dataURL = resizeImage(image, scope);
                        imageResult.resized = {
                            dataURL: dataURL,
                            type: dataURL.match(/:(.+\/.+)/)[1]
                        };
                        callback(imageResult);
                    });
                };
                applyScope = function (imageResult) {
                    scope.$apply(function () {
                        if (attrs.multiple) {
                            scope.image.push(imageResult);
                        } else {
                            scope.image = imageResult;
                        }
                    });
                };
                fileToDataURL = function (file, scope) {
                    var deferred, reader;
                    deferred = q.defer();
                    reader = new FileReader();
                    reader.onload = function (e) {
                        var imageResult;
                        imageResult = {
                            file: file,
                            url: URL.createObjectURL(file),
                            dataURL: e.target.result
                        };
                        if (scope.resizeMaxHeight || scope.resizeMaxWidth) {
                            doResizing(imageResult, function (imageResult) {
                                applyScope(imageResult);
                            });
                        } else {
                            applyScope(imageResult);
                        }
                    };
                    reader.readAsDataURL(file);
                    return deferred.promise;
                };
                element.bind('change', function (evt) {
                    if (attrs.multiple) {
                        scope.image = [];
                    }
                    var files = evt.target.files;
                    for (var i = 0; i < files.length; i++) {
                        fileToDataURL(files[i], scope);
                    }
                });
            }
        };
    };

    var ChartDraw = function (filter) {
        return {
            restrict: 'E',
            template: '<canvas></canvas>',
            scope: {
                chartData: '=value'
            },
            transclude: true,
            replace: true,
            link: function (scope, element) {
                var chart;
                scope.$watch(function () {
                    return scope.chartData;
                }, function (value) {
                    if (!value) {
                        element.parent().find('.chart-legend').remove();
                        element.empty();
                        return;
                    } else {
                        element.parent().find('.chart-legend').remove();
                    }

                    if (chart !== undefined) {
                        chart.destroy();
                    }
                    var ctx = element[0].getContext('2d');
                    var options = {
                        bezierCurve: false,
                        scaleShowGridLines: true,
                        scaleGridLineColor: 'rgba(0,0,0,.05)',
                        scaleGridLineWidth: 1,
                        datasetFill: false,
                        responsive: true,
                        showTooltip: true,
                        tooltipFontSize: 10,
                        // String - Tooltip font weight style
                        tooltipFontStyle: 'normal',
                        // String - Tooltip label font colour
                        tooltipFontColor: '#fff',
                        // Number - Tooltip title font size in pixels
                        tooltipTitleFontSize: 12,
                        tooltipTemplate: '<%=label%>: <%= Math.round(value) %>',
                        multiTooltipTemplate: '<%=datasetLabel%>: <%= Math.round(value) %>',

                        legendTemplate: '<ul class="chart-legend"><% for (var i=0; i<datasets.length; i++){%><li class="legend-item"><span style="background-color:<%=datasets[i].strokeColor%>"></span><%if(datasets[i].label){%><%=datasets[i].label%><%}%></li><%}%></ul>'
                    };
                    Chart.defaults.global.pointHitDetectionRadius = 1;
                    chart = new Chart(ctx).Line(scope.chartData, options);
                    var legend = $(chart.generateLegend());
                    var vel = $('<li class="legend-item" />');
                    vel.html('Velocity: ' + (Math.round(scope.chartData.velocity * 100) / 100));
                    var eta = $('<li class="legend-item" />');
                    eta.html('ETA: ' + filter('date')(new Date(scope.chartData.eta), 'MMM dd, yyyy'));
                    var pp = $('<li class="legend-item" />');
                    pp.html('Planned Points: ' + scope.chartData.planned_points);
                    legend.append(vel);
                    legend.append(eta);
                    legend.append(pp);
                    element.parent().prepend(legend);
                    return chart;
                });
            }
        };
    };

    var OnEscape = function () {
        return function (scope, elm, attr) {
            elm.bind('keydown', function (e) {
                if (e.keyCode === 27) {
                    scope.$apply(attr.onEsc);
                }
            });
        };
    };

    var OnEnter = function () {
        return function (scope, elm, attr) {
            elm.bind('keypress', function (e) {
                if (e.keyCode === 13) {
                    scope.$apply(attr.onEnter);
                }
            });
        };
    };

    var CalculateWithBoard = function (rootScope, timeout) {
        return {
            link: function () {
                rootScope.$on('board-loaded', function () {
                    var calculateWidth = function () {
                        var list_width = 0;
                        var total_columns = $('.column').length;
                        list_width = $('.column').width() * total_columns;
                        list_width += 2 * total_columns;
                        //Set the area with the summatory of the cols width
                        $('.board-area').width(list_width);

                        //set same height of content column
                        $('.task-list').each(function () {
                            $(this).css('min-height', $(this).parent().parent().height());
                        });
                    };
                    timeout(calculateWidth, 0);
                });
            }
        };
    };

    var editableTagInput = function (editableDirectiveFactory) {
        return editableDirectiveFactory({
            directiveName: 'editableTags',
            inputTpl: '<div></div>',
            render: function () {
                this.parent.render.call(this);
                var tagIn = '<tags-input ng-model="$data" replace-spaces-with-dashes="false" placeholder="Add Label"></tags-input>';
                this.inputEl.before(tagIn);
                if (this.attrs.eStyle) {
                    this.inputEl.style = this.attrs.eStyle;
                }
            },
            autosubmit: function () {
                var self = this;
                self.inputEl.bind('change', function () {
                    self.scope.$apply(function () {
                        self.scope.$form.$submit();
                    });
                });
            }
        });
    };


    var contentEditable = function () {
        return {
            restrict: 'A', // only activate on element attribute
            require: '?ngModel', // get a hold of NgModelController
            link: function (scope, element, attrs, ngModel) {
                function read() {
                    var html = element.html();
                    // When we clear the content editable the browser leaves a <br> behind
                    // If strip-br attribute is provided then we strip this out
                    if (attrs.stripBr && html === '<br>') {
                        html = '';
                    }


                    if (attrs.mentions) {

                        var spans = element.find('span');
                        scope.vm.mentions = [];
                        angular.forEach(spans, function (item) {
                            scope.vm.mentions.push(item.getAttribute('data-token'));
                        });
                    }
                    ngModel.$setViewValue(html);
                }

                if (!ngModel) {
                    return;
                } // do nothing if no ng-model

                // Specify how UI should be updated
                ngModel.$render = function () {
                    if (ngModel.$viewValue !== undefined && ngModel.$viewValue !== element.html()) {
                        element.html(ngModel.$viewValue || '');
                        read();
                    }
                };

                // Listen for change events to enable binding
                element.on('blur keyup change', function () {
                    scope.$apply(read);
                });

                scope.$on('comment_saved', function () {
                    element.empty();
                });
                if (attrs.isNew) {
                    read(); // initialize
                }
            }
        };
    };


    var datepicker_fix = function () {
        return {
            restrict: 'EAC',
            require: 'ngModel',
            link: function (scope, element, attr, controller) {
                //remove the default formatter from the input directive to prevent conflict
                controller.$formatters.shift();
            }
        };
    };

    var navigation = function () {
        return {
            retrict: 'A',
            link: function (scope, elem) {
                /*
                 * Detact Mobile Browser
                 */
                if( /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ) {
                   $('html').addClass('ismobile');
                }

                //Get saved layout type from LocalStorage
                var layoutStatus = localStorage.getItem('ma-layout-status');
                if (layoutStatus == 1) {
                    angular.element(elem).addClass('sw-toggled');
                    $('#tw-switch').prop('checked', true);
                }

                angular.element(elem).on('change', '#toggle-width input:checkbox', function(){
                    if ($(this).is(':checked')) {
                        setTimeout(function(){
                            angular.element(elem).addClass('toggled sw-toggled');
                            localStorage.setItem('ma-layout-status', 1);
                            animateMainmenu(0, 100);
                        }, 250);
                    }
                    else {
                        setTimeout(function(){
                            angular.element(elem).removeClass('toggled sw-toggled');
                            localStorage.setItem('ma-layout-status', 0);
                            $('.main-menu > li').removeClass('animated');
                        }, 250);
                    }
                });


                /*
                 * Top Search
                 */
                (function(){
                    angular.element(elem).on('click', '#top-search > a', function(e){
                        e.preventDefault();
                        $('#header').addClass('search-toggled');
                    });

                    angular.element(elem).on('click', '#top-search-close', function(e){
                        e.preventDefault();

                        $('#header').removeClass('search-toggled');
                    });
                })();

                //Toggle
                angular.element(elem).on('click', '#menu-trigger, #chat-trigger', function (e) {
                    e.preventDefault();
                    var x = $(this).data('trigger');

                    $(x).toggleClass('toggled');
                    $(this).toggleClass('open');
                    angular.element(elem).toggleClass('modal-open');

                    //Close opened sub-menus
                    $('.sub-menu.toggled').not('.active').each(function () {
                        $(this).removeClass('toggled');
                        $(this).find('ul').hide();
                    });


                    $('.profile-menu .main-menu').hide();

                    var $elem;
                    var $elem2;

                    if (x === '#sidebar') {

                        $elem = '#sidebar';
                        $elem2 = '#menu-trigger';

                        $('#chat-trigger').removeClass('open');

                        if (!$('#chat').hasClass('toggled')) {
                            $('#header').toggleClass('sidebar-toggled');
                        }
                        else {
                            $('#chat').removeClass('toggled');
                        }
                    }

                    if (x === '#chat') {
                        $elem = '#chat';
                        $elem2 = '#chat-trigger';

                        $('#menu-trigger').removeClass('open');

                        if (!$('#sidebar').hasClass('toggled')) {
                            $('#header').toggleClass('sidebar-toggled');
                        }
                        else {
                            $('#sidebar').removeClass('toggled');
                        }
                    }

                    //When clicking outside
                    if ($('#header').hasClass('sidebar-toggled')) {
                        $(document).on('click', function (e) {
                            if (($(e.target).closest($elem).length === 0) && ($(e.target).closest($elem2).length === 0)) {
                                setTimeout(function () {
                                    $('body').removeClass('modal-open');
                                    $($elem).removeClass('toggled');
                                    $('#header').removeClass('sidebar-toggled');
                                    $($elem2).removeClass('open');
                                });
                            }
                        });
                    }
                });

                //Submenu
                angular.element(elem).on('click', '.sub-menu > a', function (e) {
                    e.preventDefault();
                    $(this).next().slideToggle(200);
                    $(this).parent().toggleClass('toggled');
                });

                angular.element(elem).on('click', '.profile-menu > a', function(e){
                    e.preventDefault();
                    $(this).parent().toggleClass('toggled');
                    $(this).next().slideToggle(200);
                });
            }
        };
    };

    var floatInputs = function(){
        return {
            restrict: 'C',
            link: function(scope, elem){
                //Add blue animated border and remove with condition when focus and blur

                angular.element(elem).on('focus', function(){
                    $(this).closest('.fg-line').addClass('fg-toggled');
                });

                angular.element(elem).on('blur', function(){
                    var p = $(this).closest('.form-group');
                    var i = p.find('.form-control').val();

                    if (p.hasClass('fg-float')) {
                        if (i.length == 0) {
                            $(this).closest('.fg-line').removeClass('fg-toggled');
                        }
                    }
                    else {
                        $(this).closest('.fg-line').removeClass('fg-toggled');
                    }
                });

                if(angular.element(elem).val().length == 0){
                   angular.element(elem).addClass('fg-toggled');
                }
            }
        };
    };

    ImageFunction.$inject = ['$window', '$q'];
    editableTagInput.$inject = ['editableDirectiveFactory'];
    ChartDraw.$inject = ['$filter'];
    CalculateWithBoard.$inject = ['$rootScope', '$timeout'];

    angular.module('Coati.Directives', ['Coati.Config'])
        .directive('image', ImageFunction)
        .directive('chart', ChartDraw)
        .directive('onEsc', OnEscape)
        .directive('onEnter', OnEnter)
        .directive('prepareBoard', CalculateWithBoard)
        .directive('editableTags', editableTagInput)
        .directive('datepickerPopup', datepicker_fix)
        .directive('contenteditable', contentEditable)
        .directive('navigation', navigation)
        .directive('fgInput', floatInputs);


}(angular));