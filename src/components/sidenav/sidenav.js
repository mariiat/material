(function() {
'use strict';

/**
 * @ngdoc module
 * @name material.components.sidenav
 *
 * @description
 * A Sidenav QP component.
 */
angular.module('material.components.sidenav', [
    'material.core',
    'material.components.backdrop'
  ])
  .factory('$mdSidenav', SidenavService )
  .directive('mdSidenav', SidenavDirective)
  .controller('$mdSidenavController', SidenavController);


/**
 * @private
 * @ngdoc service
 * @name $mdSidenav
 * @module material.components.sidenav
 *
 * @description
 * `$mdSidenav` makes it easy to interact with multiple sidenavs
 * in an app.
 *
 * @usage
 * <hljs lang="js">
 * // Async lookup for sidenav instance; will resolve when the instance is available
 * $mdSidenav(componentId).then(function(instance) {
 *   $log.debug( componentId + "is now ready" );
 * });
 * </hljs>
 * <hljs lang="js">
 * // Async toggle the given sidenav;
 * // when instance is known ready and lazy lookup is not needed.
 * $mdSidenav(componentId)
 *    .toggle()
 *    .then(function(){
 *      $log.debug('toggled');
 *    });
 * </hljs>
 * <hljs lang="js">
 * // Async open the given sidenav
 * $mdSidenav(componentId)
 *    .open();
 *    .then(function(){
 *      $log.debug('opened');
 *    });
 * </hljs>
 * <hljs lang="js">
 * // Async close the given sidenav
 * $mdSidenav(componentId)
 *    .close();
 *    .then(function(){
 *      $log.debug('closed');
 *    });
 * </hljs>
 * <hljs lang="js">
 * // Sync check to see if the specified sidenav is set to be open
 * $mdSidenav(componentId).isOpen();
 * </hljs>
 * <hljs lang="js">
 * // Sync check to whether given sidenav is locked open
 * // If this is true, the sidenav will be open regardless of close()
 * $mdSidenav(componentId).isLockedOpen();
 * </hljs>
 */
function SidenavService($mdComponentRegistry, $q) {
  return function(handle) {

    // Lookup the controller instance for the specified sidNav instance
    var self;
    var errorMsg = "SideNav '" + handle + "' is not available!";
    var instance = $mdComponentRegistry.get(handle);

    if(!instance) {
      $mdComponentRegistry.notFoundError(handle);
    }

    return self = {
      // -----------------
      // Sync methods
      // -----------------
      isOpen: function() {
        return instance && instance.isOpen();
      },
      isLockedOpen: function() {
        return instance && instance.isLockedOpen();
      },
      // -----------------
      // Async methods
      // -----------------
      toggle: function() {
        return instance ? instance.toggle() : $q.reject(errorMsg);
      },
      open: function() {
        return instance ? instance.open() : $q.reject(errorMsg);
      },
      close: function() {
        return instance ? instance.close() : $q.reject(errorMsg);
      },
      then : function( callbackFn ) {
        var promise = instance ? $q.when(instance) : waitForInstance();
        return promise.then( callbackFn || angular.noop );
      }
    };

    /**
     * Deferred lookup of component instance using $component registry
     */
    function waitForInstance() {
      return $mdComponentRegistry
                .when(handle)
                .then(function( it ){
                  instance = it;
                  return it;
                });
    }
  };
}

/**
 * @ngdoc directive
 * @name mdSidenav
 * @module material.components.sidenav
 * @restrict E
 *
 * @description
 *
 * A Sidenav component that can be opened and closed programatically.
 *
 * By default, upon opening it will slide out on top of the main content area.
 *
 * @usage
 * <hljs lang="html">
 * <div layout="row" ng-controller="MyController">
 *   <md-sidenav md-component-id="left" class="md-sidenav-left">
 *     Left Nav!
 *   </md-sidenav>
 *
 *   <md-content>
 *     Center Content
 *     <md-button ng-click="openLeftMenu()">
 *       Open Left Menu
 *     </md-button>
 *   </md-content>
 *
 *   <md-sidenav md-component-id="right"
 *     md-is-locked-open="$mdMedia('min-width: 333px')"
 *     class="md-sidenav-right">
 *     Right Nav!
 *   </md-sidenav>
 * </div>
 * </hljs>
 *
 * <hljs lang="js">
 * var app = angular.module('myApp', ['ngMaterial']);
 * app.controller('MyController', function($scope, $mdSidenav) {
 *   $scope.openLeftMenu = function() {
 *     $mdSidenav('left').toggle();
 *   };
 * });
 * </hljs>
 *
 * @param {expression=} md-is-open A model bound to whether the sidenav is opened.
 * @param {string=} md-component-id componentId to use with $mdSidenav service.
 * @param {expression=} md-is-locked-open When this expression evalutes to true,
 * the sidenav 'locks open': it falls into the content's flow instead
 * of appearing over it. This overrides the `is-open` attribute.
 *
 * The $mdMedia() service is exposed to the is-locked-open attribute, which
 * can be given a media query or one of the `sm`, `gt-sm`, `md`, `gt-md`, `lg` or `gt-lg` presets.
 * Examples:
 *
 *   - `<md-sidenav md-is-locked-open="shouldLockOpen"></md-sidenav>`
 *   - `<md-sidenav md-is-locked-open="$mdMedia('min-width: 1000px')"></md-sidenav>`
 *   - `<md-sidenav md-is-locked-open="$mdMedia('sm')"></md-sidenav>` (locks open on small screens)
 */
function SidenavDirective($timeout, $animate, $parse, $log, $mdMedia, $mdConstant, $compile, $mdTheming, $q, $document) {
  return {
    restrict: 'E',
    scope: {
      isOpen: '=?mdIsOpen'
    },
    controller: '$mdSidenavController',
    compile: function(element) {
      element.addClass('md-closed');
      element.attr('tabIndex', '-1');
      return postLink;
    }
  };

  /**
   * Directive Post Link function...
   */
  function postLink(scope, element, attr, sidenavCtrl) {
    var lastParentOverFlow;
    var triggeringElement = null;
    var promise = $q.when(true);

    var isLockedOpenParsed = $parse(attr.mdIsLockedOpen);
    var isLocked = function() {
      return isLockedOpenParsed(scope.$parent, {
        $media: function(arg) {
          $log.warn("$media is deprecated for is-locked-open. Use $mdMedia instead.");
          return $mdMedia(arg);
        },
        $mdMedia: $mdMedia
      });
    };
    var backdrop = $compile(
      '<md-backdrop class="md-sidenav-backdrop md-opaque ng-enter">'
    )(scope);

    element.on('$destroy', sidenavCtrl.destroy);
    $mdTheming.inherit(backdrop, element);

    scope.$watch(isLocked, updateIsLocked);
    scope.$watch('isOpen', updateIsOpen);


    // Publish special accessor for the Controller instance
    sidenavCtrl.$toggleOpen = toggleOpen;

    /**
     * Toggle the DOM classes to indicate `locked`
     * @param isLocked
     */
    function updateIsLocked(isLocked, oldValue) {
      scope.isLockedOpen = isLocked;
      if (isLocked === oldValue) {
        element.toggleClass('md-locked-open', !!isLocked);
      } else {
        $animate[isLocked ? 'addClass' : 'removeClass'](element, 'md-locked-open');
      }
      backdrop.toggleClass('md-locked-open', !!isLocked);
    }

    /**
     * Toggle the SideNav view and attach/detach listeners
     * @param isOpen
     */
    function updateIsOpen(isOpen) {
      var parent = element.parent();

      parent[isOpen ? 'on' : 'off']('keydown', onKeyDown);
      backdrop[isOpen ? 'on' : 'off']('click', close);

      if ( isOpen ) {
        // Capture upon opening..
        triggeringElement = $document[0].activeElement;
      }

      disableParentScroll(isOpen);

      return promise = $q.all([
        $animate[isOpen ? 'enter' : 'leave'](backdrop, parent),
        //TODO remove after fixed (body scroll when sidenav opened)
        $animate[isOpen ? 'addClass' : 'removeClass']($document.find('body'),'sidenav-opened'),
        $animate[isOpen ? 'removeClass' : 'addClass'](element, 'md-closed').then(function() {
          // If we opened, and haven't closed again before the animation finished
          if (scope.isOpen) {
            element.focus();
          }
        })
      ]);
    }

    /**
     * Prevent parent scrolling (when the SideNav is open)
     */
    function disableParentScroll(disabled) {
      var parent = element.parent();
      if ( disabled ) {
        lastParentOverFlow = parent.css('overflow');
        parent.css('overflow', 'hidden');
      } else if (angular.isDefined(lastParentOverFlow)) {
        parent.css('overflow', lastParentOverFlow);
        lastParentOverFlow = undefined;
      }
    }

    /**
     * Toggle the sideNav view and publish a promise to be resolved when
     * the view animation finishes.
     *
     * @param isOpen
     * @returns {*}
     */
    function toggleOpen( isOpen ) {
      if (scope.isOpen == isOpen ) {

        return $q.when(true);

      } else {
        var deferred = $q.defer();

        // Toggle value to force an async `updateIsOpen()` to run
        scope.isOpen = isOpen;

        $timeout(function() {

          // When the current `updateIsOpen()` animation finishes
          promise.then(function(result){

            if ( !scope.isOpen ) {
              // reset focus to originating element (if available) upon close
              triggeringElement && triggeringElement.focus();
              triggeringElement = null;
            }

            deferred.resolve(result);
          });

        },0,false);

        return deferred.promise;
      }
    }

    /**
     * Auto-close sideNav when the `escape` key is pressed.
     * @param evt
     */
    function onKeyDown(ev) {
      var isEscape = (ev.keyCode === $mdConstant.KEY_CODE.ESCAPE);
      return isEscape ? close(ev) : $q.when(true);
    }

    /**
     * With backdrop `clicks` or `escape` key-press, immediately
     * apply the CSS close transition... Then notify the controller
     * to close() and perform its own actions.
     */
    function close(ev) {
      ev.preventDefault();
      ev.stopPropagation();

      return sidenavCtrl.close();
    }

  }
}

/*
 * @private
 * @ngdoc controller
 * @name SidenavController
 * @module material.components.sidenav
 *
 */
function SidenavController($scope, $element, $attrs, $mdComponentRegistry, $q) {

  var self = this;

  // Use Default internal method until overridden by directive postLink

  // Synchronous getters
  self.isOpen = function() { return !!$scope.isOpen; };
  self.isLockedOpen = function() { return !!$scope.isLockedOpen; };

  // Async actions
  self.open   = function() { return self.$toggleOpen( true );  };
  self.close  = function() { return self.$toggleOpen( false ); };
  self.toggle = function() { return self.$toggleOpen( !$scope.isOpen );  };

  self.$toggleOpen = function() { return $q.when($scope.isOpen); };

  self.destroy = $mdComponentRegistry.register(self, $attrs.mdComponentId);
}



})();
