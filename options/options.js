"use strict";

$(() => {
  $('.message a').click(e => {
    $('.error').hide();
    $('.login-container').animate({height: 'hide', opacity: 'hide'}, 'slow');
    $(`.${e.target.name}-login-container`).animate({height: 'show', opacity: 'show'}, 'slow');
  });
  $('#login').click(e => {
    addCred(getGithubParam());
  });
  $('#ghe-login').click(e => {
    addCred(getGHEParam());
  });
  $('#bitbucket-login').click(e => {
    addCred(getBitbucketParam());
  });
  $('#logout').click(e => {
    logout();
  });

  checkToken()
  .then(item => {
    $('.login-container').hide();
    $('.logout-container').show();
    let user = item.user, domain, userLink, tokenLink;
    if(item.scm !== 'bitbucket') {
      domain = '@Github.com';
      userLink = `https://github.com/${item.user}`;
      tokenLink = 'https://github.com/settings/tokens';
      if (item.baseUrl !== 'https://api.github.com') {
        let match = item.baseUrl.match(/:\/\/(.*)\/api\/v3/);
        if (!match || !match[1]) {
          domain = '';
          userLink = '';
          tokenLink = '';
        } else {
          domain = `@${match[1]}`;
          userLink = `https://${match[1]}/${item.user}`;
          tokenLink = `https://${match[1]}/settings/tokens`;
        }
      }
    } else {
      domain = '@Bitbucket.org';
      userLink = `https://bitbucket.org/${user}`;
      tokenLink = `https://bitbucket.org/account/user/${user}/api`;
    }

    $('#login-user').text(`${user}${domain}`).attr('href', userLink);
    $('#token').attr('href', tokenLink);
  })
  .catch(err => {
    //not logged in
  })
})

function getGithubParam() {
  const scm = 'github';
  const username = $('#username').val();
  const password = $('#password').val();
  const token = $('#accesstoken').val();
  const baseUrl = `https://api.github.com`;
  const otp = $('#otp').val();
  return {
    scm,
    username,
    password,
    token,
    baseUrl,
    otp
  };
}

function getGHEParam() {
  const scm = 'github';
  const username = $('#ghe-username').val();
  const password = $('#ghe-password').val();
  const token = $('#ghe-accesstoken').val();
  const baseUrl = $('#ghe-url').val() + '/api/v3';
  const otp = $('#ghe-otp').val();
  return {
    scm,
    username,
    password,
    token,
    baseUrl,
    otp
  };
}

function getBitbucketParam() {
  const scm = 'bitbucket';
  const username = $('#bitbucket-email').val();
  const password = $('#bitbucket-password').val();
  const baseUrl = `https://api.bitbucket.org/2.0`;
  return {
    scm,
    username,
    password,
    baseUrl
  }
}

function addCred(param) {
  if (param.username === '') {
    return;
  }
  if (param.password === '' && param.token === '') {
    return;
  }

  if (param.scm === 'bitbucket') return loginBitbucket(param);
  if (param.password !== '' && param.scm === 'github') return loginGithub(param);

  addStar(param.token)
  .then(() => {
    chrome.storage.sync.set({scm: param.scm, user: param.username, token: param.token, baseUrl: param.baseUrl}, () => {
      location.reload();
    });
    chrome.storage.local.get('tab', (item) => {
      if(item.tab) {
        chrome.tabs.reload(item.tab);
      }
    });
  })
}

function loginGithub(param) {
  const username = param.username;
  const password = param.password;
  const baseUrl = param.baseUrl;
  const otp = param.otp
  const payload = {
    scopes: [
      'repo',
      'gist'
    ],
    note: 'gas-github_' + Date.now()
  }
  let headers = {
    Authorization: 'Basic ' + btoa(`${username}:${password}`)
  };
  if (otp && otp !== '') {
    headers['X-GitHub-OTP'] = otp;
  }
  $.ajax({
    url: `${baseUrl}/authorizations`,
    headers: headers,
    method: 'POST',
    dataType: 'json',
    contentType: 'application/json',
    data: JSON.stringify(payload)
  })
  .done(response => {
    addStar(response.token)
    .then(() => {
      return $.getJSON(
        `${baseUrl}/user`,
        { access_token: response.token }
      )
    }) 
    .then(userinfo => {
      chrome.storage.sync.set({scm: param.scm, user: userinfo.login, token: response.token, baseUrl: baseUrl}, () => {
        location.reload();
      });
      chrome.storage.local.get('tab', (item) => {
        if(item.tab) {
          chrome.tabs.reload(item.tab);
        }
      });
    })
  })
  .fail(err => {
    if (err.status == 401 && 
        err.getResponseHeader('X-GitHub-OTP') !== null && 
        $('.login-item-otp').filter(':visible').length == 0) {
      $('.login-item').animate({height: 'toggle', opacity: 'toggle'}, 'slow');
    } else {
      $('.error').show();
    }
  })
}

function loginBitbucket(param) {
  const username = param.username;
  const password = param.password;
  const baseUrl = param.baseUrl;
  const headers = {
    Authorization: `Basic RmZIVE02ZnN5NDJQQlJDRjRQOmVDZDN0TTh5TUpUeTJSMld4bTJWUzZoYWVKdnpuNzdw`
  }  
  $.ajax({
    url: 'https://bitbucket.org/site/oauth2/access_token',
    headers: headers,
    method: 'POST',
    dataType: 'json',
    contentType: 'application/x-www-form-urlencoded',
    data: {
      grant_type: 'password',
      username: username,
      password: password
    }
  })
  .done(response => {
    return $.getJSON(
      `${baseUrl}/user`,
      { access_token: response.access_token }
    )
    .done(user => {
      chrome.storage.sync.set({scm: param.scm, user: user.username, token: response.refresh_token, baseUrl: baseUrl}, () => {
        location.reload();
      });
      chrome.storage.local.get('tab', (item) => {
        if(item.tab) {
          chrome.tabs.reload(item.tab);
        }
      });
    });
  })
  .fail(() => {
    $('.error').show();
  })
}

function logout() {
  chrome.storage.sync.remove(['scm', 'token', 'user', 'baseUrl'], () => {
    location.reload();
  });
  chrome.storage.local.get('tab', (item) => {
    if(item.tab) {
      chrome.tabs.reload(item.tab);          
    }
  });
}

function checkToken() {
  return new Promise((resolve, reject) => {
    chrome.storage.sync.get(['scm', 'token', 'user', 'baseUrl'], (item) => {
      if (item.token && item.token !== ''){
        resolve(item);
      }
      else reject(new Error('can not get access token'));
    });
  })
}

function addStar(token) {
  if(!$('#star').is(':checked') || $('#star').is(':hidden')) {
    return Promise.resolve(null);
  }
  return new Promise(resolve => {
    $.ajax({
      url: `https://api.github.com/user/starred/leonhartX/gas-github`,
      headers: {
        'Content-Length': 0,
        'Authorization': `token ${token}`
      },
      method: 'PUT',
    })
    .always(resolve);
  })
}