var host = 'http://104.131.58.217:8000';
var user = '';

// Gets the active tab's URL
function getCurrentTabUrl(callback) {
  var queryInfo = {
    active: true,
    currentWindow: true
  };

  chrome.tabs.query(queryInfo, function(tabs) {
    // Only taking the active tab, so it is the first and only result
    // in the tabs object
    var tab = tabs[0];
    var url = tab.url;

    callback(url);
  });
}

// Takes in username for whom login information is shared with, hostname to
// find shared passwords for, and a callback function which will be called
// with one argument: an array of the name of the owners. If there are no
// owners for the specified user and hostname, then it will be an empty
// array
function getShared(user, hostname, callback) {
  var apiUrl = host + '/api/moochers/' + user + '/';
  var request = new XMLHttpRequest();

  request.open('GET', apiUrl, true);
  request.onreadystatechange = function() {
    if (request.readyState == 4) {
      var response = JSON.parse(request.responseText);
      var owners = new Array();

      for (var i = 0; i < response.length; i++) {
        var responseHostname = response[i]['service'];

        if (hostname.toLowerCase() === responseHostname.toLowerCase()) {
          console.log('correct hostname');
          owners.push(response[i]['owner']);
        }
      }

      callback(owners);
    }
  };
  request.send();
}

function getCurrentUser(callback) {
  var apiUrl = host + '/api/users/current/';
  var request = new XMLHttpRequest();

  request.open('GET', apiUrl, true);
  request.onreadystatechange = function() {
    if (request.readyState == 4) {
      if (request.status == 200) {
        user = request.responseText;

        if (callback != null) {
          callback();
        }
      }
    }
  };
  request.send();
}

// Sends cookie to be allowed to be used for specified moocher under current
// user
function shareLoginInfo(moocher) {
  getCurrentTabUrl(function(url) {
    var urlParts = url.split('/');
    var hostname = urlParts[0] + '//' + urlParts[2];
    var service = urlParts[2];

    chrome.cookies.getAll({
      "url": hostname
    }, function(cookies) {
      getCurrentUser(function() {
        /* For setting up relations */
        var apiUrlRelations = host + '/api/relations/';
        var requestRelations = new XMLHttpRequest();
        var paramsRelations = new FormData(); 

        paramsRelations.append('owner', user);
        paramsRelations.append('moocher', moocher);
        paramsRelations.append('service', service);

        requestRelations.open('POST', apiUrlRelations, true);
        requestRelations.onreadystatechange = function() {
          if (requestRelations.readyState == 4) {
            if (requestRelations.status == 200 || requestRelations.status == 400) {
              var apiUrl = host + '/api/cookie/' + moocher + '/' + service + '/';
              var request = new XMLHttpRequest();
              var params = new FormData();

              params.append('cookies', JSON.stringify(cookies));
              request.open('POST', apiUrl, true);
              request.onreadystatechange = function() {
                if (request.readyState == 4) {
                  if (request.status == 200) {
                    removeElementById('successParagraph');
                    
                    var successParagraph = document.createElement('p');
                    var successText = document.createTextNode('Successfully shared login with ' + moocher + '!');

                    successParagraph.setAttribute('id', 'successParagraph');
                    successParagraph.appendChild(successText);

                    document.getElementById('content').insertBefore(successParagraph, document.getElementById('logoutButton'));
                  }
                }
              };
              request.send(params);
            }
          }
        };
        requestRelations.send(paramsRelations);
      });
    });
  });
}

// Writes cookies with hostname to local Chrome cookie storage
function writeCookies(hostname, cookies) {
  getCurrentTabUrl(function(url) {
    for (var i = 0; i < cookies.length; i++) {
      var cookie = cookies[i];

      chrome.cookies.remove({
        "url": url,
        "name": cookie.name
      });
      chrome.cookies.set({
        "url": url,
        "name": cookie.name,
        "value": cookie.value,
        "domain": cookie.domain,
        "path": cookie.path,
        "secure": cookie.secure,
        "httpOnly": cookie.httpOnly,
        "expirationDate": cookie.expirationDate,
        "storeId": cookie.storeId
      });
    }
  });

  chrome.tabs.getSelected(null, function(tab) {
    var code = 'window.location.reload();';
    chrome.tabs.executeScript(tab.id, {code: code});
  });
}

// Gets login info of specified owner from hostname, provided that moocher
// is authorized by owner to get the login info
function getLoginInfo(owner, hostname) {
  var apiUrl = host + '/api/cookie/' + owner + '/' + hostname + '/';
  var request = new XMLHttpRequest();

  request.open('GET', apiUrl, true);
  request.onreadystatechange = function() {
    if (request.readyState == 4) {
      if (request.status == 200) {
        var cookies = JSON.parse(request.responseText);
        writeCookies(hostname, cookies);
      }
    }
  };
  request.send();
}

// Adds relevant buttons for when user is logged into Larry Herman service
function addLoginInfoButtons() {
  // Remove unnecessary content
  removeElementById('loginButton');
  removeElementById('failedLoginParagraph');
  removeElementById('noOwnersParagraph');
  removeElementById('shareLoginButton');
  removeElementById('getLoginButton');
  removeElementById('logoutButton');
  removeElementById('noConnection');
  removeElementById('retryButton');
  removeElementById('login');
  removeElementById('successParagraph');
  removeElementById('shareLoginField');
  removeElementByClass('owner');

  var shareLoginField = document.createElement('input');
  var shareLoginButton = document.createElement('button');
  var shareLoginText = document.createTextNode('Share your login!');

  shareLoginField.setAttribute('id', 'shareLoginField');
  shareLoginField.setAttribute('name', 'user');
  shareLoginField.setAttribute('placeholder', 'Friend\'s username');
  shareLoginField.required = true;

  shareLoginButton.type = 'button';
  shareLoginButton.onclick = function() {
    shareLoginInfo(shareLoginField.value);
  };
  shareLoginButton.setAttribute('id', 'shareLoginButton');

  var getLoginButton = document.createElement('button');
  var getLoginText = document.createTextNode('Get a friend\'s login!');

  getLoginButton.type = 'button';
  getLoginButton.onclick = function () { 
    // Remove previous #owners div
    removeElementById('owners');

    getCurrentTabUrl(function(url) {
      var hostname = url.split('/')[2];

      getShared(user, hostname, function(owners) {
        var ownersDiv = document.createElement('div');
        ownersDiv.setAttribute('id', 'owners');

        if (owners.length === 0) {
          var noOwnersParagraph = document.createElement('p');
          var noOwnersText = document.createTextNode('No shared passwords found');

          noOwnersParagraph.appendChild(noOwnersText);
          noOwnersParagraph.setAttribute('id', 'noOwnersParagraph');

          ownersDiv.appendChild(noOwnersParagraph);
        } else {
          for (var i = 0; i < owners.length; i++) {
            var owner = document.createElement('div');
            var ownerParagraph = document.createElement('p');
            var ownerName = document.createTextNode(owners[i]);
            var getCookieButton = document.createElement('button');
            var getCookieText = document.createTextNode('Use');

            getCookieButton.type = 'button';
            getCookieButton.onclick = function() {
              var i = parseInt(this.getAttribute('id').slice(-1));
              getLoginInfo(owners[i], hostname);
            };
            getCookieButton.setAttribute('id', 'getCookieButton' + i);

            ownerParagraph.style.display = 'inline-block';
            getCookieButton.style.display = 'inline-block';

            owner.setAttribute('class', 'owner');

            getCookieButton.appendChild(getCookieText);
            ownerParagraph.appendChild(ownerName);
            owner.appendChild(ownerParagraph);
            owner.appendChild(getCookieButton);
            ownersDiv.appendChild(owner);
          }
        }

        document.getElementById('content').appendChild(ownersDiv);
      });
    });
  };
  getLoginButton.setAttribute('id', 'getLoginButton');

  var logoutButton = document.createElement('button');
  var logoutText = document.createTextNode('Log out');

  logoutButton.type = 'button';
  logoutButton.onclick = logout;
  logoutButton.setAttribute('id', 'logoutButton');

  shareLoginButton.appendChild(shareLoginText);
  getLoginButton.appendChild(getLoginText);
  logoutButton.appendChild(logoutText);

  document.getElementById('content').appendChild(shareLoginField);
  document.getElementById('content').appendChild(shareLoginButton);
  document.getElementById('content').appendChild(getLoginButton);
  document.getElementById('content').appendChild(logoutButton);
};

// Logs the user out from the Larry Herman service
function logout() {
  removeElementById('loginButton');
  removeElementById('failedLoginParagraph');
  removeElementById('noOwnersParagraph');
  removeElementById('shareLoginButton');
  removeElementById('getLoginButton');
  removeElementById('logoutButton');
  removeElementById('noConnection');
  removeElementById('retryButton');
  removeElementById('login');
  removeElementById('successParagraph');
  removeElementById('shareLoginField');
  removeElementByClass('owner');

  var apiUrl = host + '/api/users/logout/';
  var request = new XMLHttpRequest();

  request.open('POST', apiUrl, true);
  request.onreadystatechange = function() {
    if (request.readyState == 4) {
      if (request.status == 200) {
        postLogin(addLoginInfoButtons, function() {
          var failedLoginParagraph = document.createElement('p');
          var failedLoginText = document.createTextNode('Failed to log in');

          failedLoginParagraph.setAttribute('id', 'failedLoginParagraph');
          failedLoginParagraph.appendChild(failedLoginText);
          document.getElementById('content').appendChild(failedLoginParagraph);
        });
      }
    }
  };
  request.send();
}

// Gets Larry Herman service login status
function getLoginStatus(callback) {
  var request = new XMLHttpRequest();
  request.open('GET', host + '/api/users/logged_in/', true);
  request.onreadystatechange = function() {
    if (request.readyState == 4 && request.status == 204) {
      callback(true);
    } else if (request.readyState == 4 && request.status == 403) {
      callback(false);
    }
  };
  request.onerror = function() {
    var noConnectionParagraph = document.createElement('p');
    var noConnectionText = document.createTextNode('Could not get a connection to the server');

    var retryButton = document.createElement('button');
    var retryButtonText = document.createTextNode('Retry');

    retryButton.value = 'button';
    retryButton.onclick = function() {
    };

    noConnectionParagraph.setAttribute('id', 'noConnection');
    retryButton.setAttribute('id', 'retryButton');
    noConnectionParagraph.appendChild(noConnectionText);
    retryButton.appendChild(retryButtonText);

    document.getElementById('content').appendChild(noConnectionParagraph);
  };
  request.send();
};

// Logs in to Larry Herman service
function postLogin(success, failure) { 
  removeElementById('loginButton');
  removeElementById('failedLoginParagraph');
  removeElementById('noOwnersParagraph');
  removeElementById('shareLoginButton');
  removeElementById('getLoginButton');
  removeElementById('logoutButton');
  removeElementById('noConnection');
  removeElementById('retryButton');
  removeElementById('successParagraph');
  removeElementById('shareLoginField');
  removeElementByClass('owner');

  showUserLogin(function(username, password) {
    var request = new XMLHttpRequest();
    var params = new FormData();

    params.append("username", username);
    params.append("password", password);

    request.open("POST", host + '/api/users/login/', true);
    request.onreadystatechange = function() {
      if (request.readyState == 4) {
        if (request.status == 200) {
          getCurrentUser(null);
          success();
        } else if (request.status == 401) {
          failure();
        } else {
          failure();
        }
      }
    };
    request.send(params);
  });
}

// Displays login flow for Larry Herman service and calls the callback with
// the username and password
function showUserLogin(callback) {
  var loginDiv = document.createElement('div');
  var loginForm = document.createElement('form');
  var userField= document.createElement('input');
  var passwordField = document.createElement('input');
  var loginHeader = document.createElement('h4');
  var loginHeaderText = document.createTextNode('Log In');
  var loginButton = document.createElement('input');

  loginDiv.setAttribute('id', 'login');

  userField.setAttribute('type', 'email');
  userField.setAttribute('name', 'user');
  userField.setAttribute('placeholder', 'Username');
  userField.required = true;

  passwordField.setAttribute('type','password');
  passwordField.setAttribute('user', 'password'); 
  passwordField.setAttribute('name', 'password');
  passwordField.setAttribute('placeholder', 'Password');
  passwordField.required = true;

  loginForm.appendChild(userField);
  loginForm.appendChild(passwordField);
  loginForm.appendChild(loginButton);

  loginHeader.appendChild(loginHeaderText);

  loginButton.type = 'submit';
  loginButton.setAttribute('value', 'Login');
  loginButton.onclick = function(event) {
    event.preventDefault();

    removeElementById('loginButton');
    removeElementById('failedLoginParagraph');
    removeElementById('noOwnersParagraph');
    removeElementById('shareLoginButton');
    removeElementById('getLoginButton');
    removeElementById('logoutButton');
    removeElementById('noConnection');
    removeElementById('retryButton');
    removeElementById('successParagraph');
    removeElementById('shareLoginField');
    removeElementByClass('owner');

    callback(userField.value, passwordField.value);
  };

  loginDiv.appendChild(loginHeader);
  loginDiv.appendChild(loginForm);
  document.getElementById('content').appendChild(loginDiv);
}

// Removes the element with specified id if it exists in the document
function removeElementById(id) {
  while (document.contains(document.getElementById(id))) {
    document.getElementById(id).remove();
  }
}

function removeElementByClass(className) {
  // TODO Fix removal of elements by class
  // querySelectorAll() doesn't work
  var elements = document.querySelectorAll('.'+className);

  for (var i = 0; i < elements.length; i++) {
    document.removeChild(elements[i]);
  }
}

document.addEventListener('DOMContentLoaded', function() {
  getLoginStatus(function(loggedIn) {
    getCurrentUser(function() {
      if (loggedIn) {
        addLoginInfoButtons();
      } else {
        postLogin(addLoginInfoButtons, function() {
          var failedLoginParagraph = document.createElement('p');
          var failedLoginText = document.createTextNode('Failed to log in');

          failedLoginParagraph.setAttribute('id', 'failedLoginParagraph');
          failedLoginParagraph.appendChild(failedLoginText);
          document.getElementById('content').appendChild(failedLoginParagraph);
        });
      }
    });
  });
});

