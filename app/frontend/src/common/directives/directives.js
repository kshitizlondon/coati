angular.module('KoalaApp.Directives', ['KoalaApp.ApiServices'])

    .directive('customDatepicker',function () {
        return {
            restrict: 'A',
            require: 'ngModel',
            link: function (scope, element, attrs, ngModelCtrl) {
                $(element).datepicker({
                    format: 'mm/dd/yyyy'
                }).on('changeDate', function (object) {
                    scope.$apply(function () {
                        ngModelCtrl.$setViewValue(object.date);
                    });
                });
            }
        };
    })
    .directive('sortableCard',function (Board) {
        return {
            restrict: 'A',
            link: function (scope, element, attrs, ngModelCtrl) {
                sortcards(element, Board);
                scope.$watch('last_changed', function () {
                    $(element).sortable('refresh');
                });
            }
        };
    })
    .directive('sortableCol',function () {
        return {
            restrict: 'A',
            scope: true,
            link: function (scope, element, attrs, ngModelCtrl) {
                var started = false;
                $(element).sortable({
                    connectWith: '.connected-cols',
                    placeholder: "column_placeholder",
                    revert: true,
                    axis: 'x',
                    items: '>li',
                    cursor: 'move',
                    tolerance: 'pointer',
                    opacity: 0.7,
                    forcePlaceholderSize: true,
                    start: function (e, ui) {
                        ui.placeholder.height(ui.helper.outerHeight());
                        ui.placeholder.width(ui.helper.outerWidth());
                        started = true;
                    },
                    stop: function (e, ui) {
                        var new_order;
                        if (started) {
                            new_order = $(element).sortable("toArray");
                            scope.$emit('update_order', new_order);
                            $(ui.item).css('z-index', 'auto');
                            started = false;
                        }
                    }
                });
                $(element).disableSelection();
            }
        };
    }).directive('updateProfile',function () {
        return {
            link: function (scope, elem, attrs, ctrl) {
                scope.$on('updateProfile', function (ev, user) {
                    if (user.profile) {
                        elem.find('img').attr('src', user.profile.picture);
                    }
                    elem.find('small').html(user.username);
                });
            }
        };
    }).directive('validDateFormat',function ($filter) {
        return {
            require: "ngModel",
            link: function (scope, elm, attrs, ctrl) {
                var regex, validator;
                regex = /^(0?[1-9]|1[012])[\/](0?[1-9]|[12][0-9]|3[01])[\/](\d{4})$/;
                validator = function (value) {
                    if (value) {
                        value = $filter('date')(value, 'MM/dd/yyyy');
                        ctrl.$setValidity('valid_date_format', regex.test(value));
                    } else {
                        ctrl.$setValidity('valid_date_format', true);
                    }
                    return value;
                };
                ctrl.$parsers.unshift(validator);
                ctrl.$formatters.unshift(validator);
            }
        };
    }).directive('prepareBoard', [
        '$timeout', function ($timeout) {
            return {
                restrict: 'A',
                link: function ($scope, element, attrs) {
                    $scope.$on('dataloaded', function () {
                        var calculateWidth = function () {
                            var list_width = 0;
                            var total_columns = $('.cols').length;
                            var w_width = $('.list-area-wrapper').width();
                            var new_width = Math.floor(w_width / total_columns);
                            // rest border and margins
                            var margin = parseInt($('.cols').css('margin-right'), 10);
                            var border = parseInt($('.cols').css('border'), 10);
                            var delta = 4;
                            new_width -= margin;
                            new_width -= border;
                            new_width -= delta;

                            var minimum_width = parseInt($('.cols').css('min-width'), 10);
                            if(new_width > minimum_width){
                                $('.cols').css('width', new_width + 'px');
                            }else{
                                $('.cols').css('width', '250px');
                            }
                            list_width = $('.cols').width() * total_columns;

                            //Set the area with the summatory of the cols width
                            if(list_width > w_width){
                                $('.list-area').width(list_width + 100);
                            }else{
                                $('.list-area').width(w_width);
                            }


                        };
                        $timeout(calculateWidth, 0);
                    });
                }
            };
        }
    ]).directive('image',function ($q) {
        'use strict';
        var URL, createImage, getResizeArea, resizeImage;
        URL = window.URL || window.webkitURL;
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
            ctx = canvas.getContext("2d");
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
            link: function (scope, element, attrs, ctrl) {
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
                    deferred = $q.defer();
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
    }).directive('chart',function () {
        return {
            restrict: 'E',
            template: '<div></div>',
            scope: {
                chartData: "=value"
            },
            transclude: true,
            replace: true,
            link: function (scope, element, attrs) {
                var chartsDefaults = {
                    chart: {
                        renderTo: element[0],
                        type: attrs.type || null,
                        height: attrs.height || null,
                        width: attrs.width || null
                    }
                };
                scope.$watch(function () {
                    return scope.chartData;
                }, function (value) {
                    var newSettings;
                    if (!value) {
                        return;
                    }
                    newSettings = {};
                    angular.extend(newSettings, chartsDefaults, scope.chartData);
                    return new Highcharts.Chart(newSettings);
                });
            }
        };
    }).directive('onEsc',function () {
        return function (scope, elm, attr) {
            elm.bind('keydown', function (e) {
                if (e.keyCode === 27) {
                    scope.$apply(attr.onEsc);
                }
            });
        };
    }).directive('onEnter', function () {
        return function (scope, elm, attr) {
            elm.bind('keypress', function (e) {
                if (e.keyCode === 13) {
                    scope.$apply(attr.onEnter);
                }
            });
        };
    })
    .directive('inlineEdit', function ($timeout) {
        return {
            scope: {
                model: '=inlineEdit',
                handleSave: '&onSave',
                handleCancel: '&onCancel'
            },
            link: function (scope, elm, attr) {
                var previousValue;

                scope.edit = function () {
                    scope.editMode = true;
                    previousValue = scope.model;
                    $timeout(function () {
                        elm.find('input')[0].focus();
                    }, 0, false);
                };
                scope.save = function () {
                    scope.editMode = false;
                    scope.handleSave({value: scope.model});
                };
                scope.cancel = function () {
                    scope.editMode = false;
                    scope.model = previousValue;
                    scope.handleCancel({value: scope.model});
                };
            },
            templateUrl: 'board/inline_edit.tpl.html'
        };
    })
    .directive('uiDraggable', function () {
        return {
            restrict:'A',
            link:function (scope, element, attrs) {
                $(element).draggable({
                    revert:true
                });
            }
        };
    })
    .directive('uiDropListener', function () {
        return {
            restrict:'A',
            link:function (scope, eDroppable, attrs) {
                $(eDroppable).droppable({
                    drop:function (event, ui) {
                        ui.draggable.draggable('option','revert',false);
                        var fnDropListener = scope.$eval(attrs.uiDropListener);
                        if (fnDropListener && angular.isFunction(fnDropListener)) {
                            var eDraggable = angular.element(ui.draggable);
                            fnDropListener(eDraggable, eDroppable, event, ui);
                        }
                    },
                    tolerance:'touch',
                    accept:'.col-lg-12',
                    out:function (event, ui) {
                        var dropArea = $(this);
                        var title = dropArea.find('.card-hover-class');
                        title.removeClass('card-hover-class');
                        title.addClass('green-bg');
                    },
                    over:function (event, ui) {
                        var dropArea = $(this);
                        var title = dropArea.find('.green-bg');
                        title.removeClass('green-bg');
                        title.addClass('card-hover-class');
                    }
                });
            }
        };
    });