// MapMarkerSet class contains information of map markers for searching.
var MapMarkerSet = function(marker, name, category, position) {
  this.marker = marker,
  this.name = name,
  this.category = category,
  this.position = position
};


// View Model of the app.
function MapViewModel() {
  var self = this;
  var map;
  var service;
  var preferredLocation;
  var infowindow;
  var mapBounds;
  var neighborhoodMarkers = [];
  var venueMarkers = [];
  var defaultNeighborhood = "Mountain View";

  self.topPicksList = ko.observableArray([]); // popular places in defined neighbor hood
  self.filteredList = ko.observableArray(self.topPicksList()); // places filtered by searching
  self.neighborhood = ko.observable(defaultNeighborhood); // defined neighborhood
  self.keyword = ko.observable(''); // search keyword. This keyword is used for place filtering
  self.listBoolean = ko.observable(true); // boolean value for list toggle
  self.settingsBoolean = ko.observable(true); // boolean value for setting toggle
  self.leftArrowBoolean = ko.observable(false); // boolean value for left arrow toggle
  self.rightArrowBoolean = ko.observable(true); // boolean value for right arrow toggle

  // list toggle method. open/close the list view
  self.listToggle = function() {
    if (self.listBoolean() === true) {
      self.listBoolean(false);
    } else {
      self.listBoolean(true);
    }
  };

  // setting toggle method. open/close setting menu
  self.settingsToggle = function() {
    if (self.settingsBoolean() === true) {
      self.settingsBoolean(false);
    } else {
      self.settingsBoolean(true);
    }
  };

  // fit map height to window size
  self.mapSize = ko.computed(function() {
    $("#map").height($(window).height());
  });

  // initialize the map
  initializeMap();

  // update the neighborhood
  self.computedNeighborhood = ko.computed(function() {
    if (self.neighborhood() != '') {
      if (venueMarkers.length > 0) {
        removeVenueMarkers();
      }
      removeNeighborhoodMarker();
      requestNeighborhood(self.neighborhood());
      self.keyword('');
    }
  });

  // trigger click event to markers when list item is clicked
  self.clickMarker = function(venue) {
    var venueName = venue.venue.name.toLowerCase();
    for (var i in venueMarkers) {
      if (venueMarkers[i].name === venueName) {
        google.maps.event.trigger(venueMarkers[i].marker, 'click');
        map.panTo(venueMarkers[i].position);
      }
    }
  };

  // update list view based on search keyword
  self.displayList = ko.computed(function() {
    var venue;
    var list = [];
    var keyword = self.keyword().toLowerCase();
    for (var i in self.topPicksList()) {
      venue = self.topPicksList()[i].venue;
      if (venue.name.toLowerCase().indexOf(keyword) != -1 ||
        venue.categories[0].name.toLowerCase().indexOf(keyword) != -1) {
        list.push(self.topPicksList()[i]);
      }
    }
    self.filteredList(list);
  });

  // update map markers based on search keyword
  self.displayMarkers = ko.computed(function() {
    filteringMarkersBy(self.keyword().toLowerCase());
  });

  // filtering method for map markers
  function filteringMarkersBy(keyword) {
    for (var i in venueMarkers) {
      if (venueMarkers[i].marker.map === null) {
        venueMarkers[i].marker.setMap(map);
      }
      if (venueMarkers[i].name.indexOf(keyword) === -1 &&
        venueMarkers[i].category.indexOf(keyword) === -1) {
        venueMarkers[i].marker.setMap(null);
      }
    }
  }

  // method for initializing the map
  function initializeMap() {
    var mapOptions = {
      zoom: 14,
      disableDefaultUI: true
    };
    map = new google.maps.Map(document.querySelector('#map'), mapOptions);
    infowindow = new google.maps.InfoWindow();
  }

  // set neighborhood marker on the map and get popular places from API
  function getNeighborhoodInformation(placeData) {
    var lat = placeData.geometry.location.lat();
    var lng = placeData.geometry.location.lng();
    var name = placeData.name;
    preferredLocation = new google.maps.LatLng(lat, lng);
    map.setCenter(preferredLocation);

    // neighborhood marker
    var marker = new google.maps.Marker({
      map: map,
      position: placeData.geometry.location,
      title: name,
      icon: "images/ic_grade_black_18dp.png"
    });
    neighborhoodMarkers.push(marker);

    google.maps.event.addListener(marker, 'click', function() {
      infowindow.setContent(name);
      infowindow.open(map, marker);
    });

    // request popular places based on preferred location
    foursquareBaseUri = "https://api.foursquare.com/v2/venues/explore?ll=";
    baseLocation = lat + ", " + lng;
    extraParams = "&limit=20&section=topPicks&day=any&time=any&locale=en&oauth_token=5WJZ5GSQURT4YEG251H42KKKOWUNQXS5EORP2HGGVO4B14AB&v=20141121";
    foursquareQueryUri = foursquareBaseUri + baseLocation + extraParams;
    $.getJSON(foursquareQueryUri, function(data) {
      self.topPicksList(data.response.groups[0].items);
      for (var i in self.topPicksList()) {
        createMarkers(self.topPicksList()[i].venue);
      }

      // change the map zoom level by suggested bounds
      var bounds = data.response.suggestedBounds;
      if (bounds != undefined) {
        mapBounds = new google.maps.LatLngBounds(
          new google.maps.LatLng(bounds.sw.lat, bounds.sw.lng),
          new google.maps.LatLng(bounds.ne.lat, bounds.ne.lng));
        map.fitBounds(mapBounds);
      }
    });
  }

  // callback method for neighborhood location
  function neighborhoodCallback(results, status) {
    if (status == google.maps.places.PlacesServiceStatus.OK) {
      getNeighborhoodInformation(results[0])
    }
  }

  // request neighborhood location data from PlaceService
  function requestNeighborhood(neighborhood) {
    var request = {
      query: neighborhood
    };
    service = new google.maps.places.PlacesService(map);
    service.textSearch(request, neighborhoodCallback);
  }

  // remove neighborhood marker from the map
  // this method is called when neighborhood is newly defined
  function removeNeighborhoodMarker() {
    for (var i in neighborhoodMarkers) {
      neighborhoodMarkers[i].setMap(null);
      neighborhoodMarkers[i] = null;
    }
    while (neighborhoodMarkers.length > 0) {
      neighborhoodMarkers.pop();
    }
  }

  // create map markers of popular places
  function createMarkers(venue) {
    var lat = venue.location.lat;
    var lng = venue.location.lng;
    var name = venue.name;
    var category = venue.categories[0].name;
    var position = new google.maps.LatLng(lat, lng);
    var address = venue.location.formattedAddress;
    var contact = venue.contact.formattedPhone;
    var foursquareUrl = "https://foursquare.com/v/" + venue.id;
    var rating = venue.rating;
    var url = venue.url;
    var slicedUrl;
    if (url && url.slice(0, 7) === 'http://') {
      slicedUrl = url.slice(7);
    } else if (url && url.slice(0, 8) === 'https://') {
      slicedUrl = url.slice(8);
    } else {
      slicedUrl = url;
    }
    var ratingImg;
    var halfRating = rating / 2;
    if (halfRating >= 4.9) {
      ratingImg = 'images/star-5.0.png';
    } else if (halfRating < 4.9 && halfRating >= 4.25) {
      ratingImg = 'images/star-4.5.png';
    } else if (halfRating < 4.25 && halfRating >= 3.75) {
      ratingImg = 'images/star-4.0.png';
    } else if (halfRating < 3.75 && halfRating >= 3.25) {
      ratingImg = 'images/star-3.5.png';
    } else if (halfRating < 3.25 && halfRating >= 2.75) {
      ratingImg = 'images/star-3.0.png';
    } else {
      ratingImg = 'images/star-2.5.png';
    }

    // marker of a popular place
    var marker = new google.maps.Marker({
      map: map,
      position: position,
      title: name
    });
    venueMarkers.push(new MapMarkerSet(marker, name.toLowerCase(), category.toLowerCase(), position));

    // DOM element for infowindow content
    var startingToken = '<div class="infowindow"><p><span class="v-name">' + name +
      '</span></p><p class="v-category"><span>' + category +
      '</span></p><p class="v-address"><span>' + address;
      
    var endingToken;
    if (contact != undefined && url != undefined) {
      endingToken = '</span></p><p><span class="v-contact">' + contact + 
        '</span></p><p><a href="' + url + '" class="v-link" target="_blank">' + slicedUrl + '</a></p>';
    } else if (contact != undefined && url === undefined) {
      endingToken = '</span></p><p><span class="v-contact">' + contact + '</span></p>';
    } else if (contact === undefined && url != undefined) {
      endingToken = '</span></p><p><a href="' + url + '" class="v-link" target="_blank">' + slicedUrl + '</a></p>';
    } else {
      endingToken = '</span></p>';
    }

    var fsToken;
    if (rating != undefined) {
      fsToken = '<p><a href="' + foursquareUrl + '" target="_blank"><img class="fs-icon" src="images/Foursquare-icon.png"></a>' +
        '<span class="v-rating">' + rating.toFixed(1) + '</span><img src="' + ratingImg + '" class="rating-stars"></p></div>';
    } else {
      fsToken = '<p><a href="' + foursquareUrl + '" target="_blank"><img class="fs-icon" src="images/Foursquare-icon.png"></a>' + 
        '<span class="v-rating"><em>no rating available</em></span></p></div>';
    }

    google.maps.event.addListener(marker, 'click', function() {
      infowindow.setContent(startingToken + endingToken + fsToken);
      infowindow.open(map, this);
      map.panTo(position);
    });
  }

  // remove markers of popular places from the map
  // this method is called when neighborhood is newly defined
  function removeVenueMarkers() {
    for (var i in venueMarkers) {
      venueMarkers[i].marker.setMap(null);
      venueMarkers[i].marker = null;
    }
    while (venueMarkers.length > 0) {
      venueMarkers.pop();
    }
  }

  // make sure the map bounds get updated on page resize
  window.addEventListener('resize', function(e) {
    map.fitBounds(mapBounds);
    $("#map").height($(window).height());
  });

  // Computed binding for horizontally swipeable list
  // referenced from http://css-tricks.com/the-javascript-behind-touch-friendly-sliders
  self.mobileList = ko.computed(function() {
    if ($(window).width() < 900) {
      $('.holder').css('width', (self.filteredList().length * 100) + '%');
      $('.slider').width($(window).width()-20);
      $('.slide').width($(window).width()-20);

      if (navigator.msMaxTouchPoints) {
        $('.slider').addClass('ms-touch');
      } else {
        var slider = {
          el: {
            slider: $(".slider"),
            holder: $(".holder")
          },
          slideWidth: $('.slider').width(),
          touchstartx: undefined,
          touchmovex: undefined,
          movex: undefined,
          index: 0,
          longTouch: undefined,

          // initiate UI event binding
          init: function() {
            this.bindUIEvents();
          },

          // reset position
          reset: function() {
            this.el.holder.css('transform', 'translate3d(-' + this.index * this.slideWidth + 'px,0,0)');
            this.movex = 0;
            this.index = 0;
            if (self.filteredList().length > 0) {
              ($('.slide'))[0].click();
            }
          },

          // binds touch events to the element
          bindUIEvents: function() {
            this.el.holder.on("touchstart", function(event) {
              slider.start(event);
            });
            this.el.holder.on("touchmove", function(event) {
              slider.move(event);
            });
            this.el.holder.on("touchend", function(event) {
              slider.end(event);
            });
          },

          start: function(event) {
            // Test for flick.
            this.longTouch = false;
            // Get the original touch position.
            this.touchstartx = event.originalEvent.touches[0].pageX;
            // The movement gets all janky if there's a transition on the elements.
            $('.animate').removeClass('animate');
          },

          move: function(event) {
            // Continuously return touch position.
            this.touchmovex = event.originalEvent.touches[0].pageX;
            // Calculate distance to translate holder.
            this.movex = this.index * this.slideWidth + (this.touchstartx - this.touchmovex);
            // Makes the holder stop moving when there is no more content.
            if (this.movex < this.slideWidth*self.filteredList().length-1) {
              this.el.holder.css('transform', 'translate3d(-' + this.movex + 'px,0,0)');
            }
          },

          end: function(event) {
            // Calculate the distance swiped.
            var absMove = Math.abs(this.index * this.slideWidth - this.movex);
            // Calculate the index. All other calculations are based on the index.
            if (absMove > this.slideWidth / 2 || this.longTouch === false) {
              if (this.movex > this.index * this.slideWidth && this.index < self.filteredList().length-1) {
                this.index++;
              } else if (this.movex < this.index * this.slideWidth && this.index > 0) {
                this.index--;
              }
            }
            // trigger click event to the focused list item
            $('.slide')[this.index].click();

            // toggle arrow booleans appropriately
            if (this.index === 0 || self.filteredList().length === 0) {
              self.leftArrowBoolean(false);
            } else {
              self.leftArrowBoolean(true);
            }
            if (this.index === self.filteredList().length-1 || self.filteredList().length < 2) {
              self.rightArrowBoolean(false);
            } else {
              self.rightArrowBoolean(true);
            }
            // Move and animate the elements.
            this.el.holder.addClass('animate').css('transform', 'translate3d(-' + this.index * this.slideWidth + 'px,0,0)');
          }
        };

        slider.init();

        // reset the slider when keyword is changed
        if (self.keyword() != '' || $('.slide').length > 0) {
          slider.reset();
          self.leftArrowBoolean(false);
        }
        // toggle right arrow boolean
        if (self.filteredList().length < 2) {
          self.rightArrowBoolean(false);
        } else {
          self.rightArrowBoolean(true);
        }
      }
    }
  });
}

// initialize the view model binding
$(function() {
  ko.applyBindings(new MapViewModel());
});
