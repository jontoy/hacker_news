$(async function() {
  // cache some selectors we'll be using quite a bit
  const $allStoriesList = $("#all-articles-list");
  const $favoriteStoriesList = $("#favorited-articles");
  const $ownStoriesList = $("#my-articles");
  const $submitForm = $("#submit-form");
  const $filteredArticles = $("#filtered-articles");
  const $loginForm = $("#login-form");
  const $userProfile = $('#user-profile');
  const $editArticleForm = $('#edit-article-form');
  const $createAccountForm = $("#create-account-form");
  const $ownStories = $("#my-articles");
  const $navUserProfile = $('#nav-user-profile');
  const $navLogin = $("#nav-login");
  const $construction = $('#construction');
  const $welcome = $('#welcome');
  const $jobs = $('#jobs');
  const $nav = $('nav');
  const $notification = $('#notification');

  // global storyList variable
  let storyList = null;

  // global currentUser variable
  let currentUser = null;

  await checkIfLoggedIn();

  const showNotification = (message) => {
    $notification.text('');
    $notification.stop().slideDown(() => {
      $notification.text(message).delay(2000).slideUp();
    });
  }
  $nav.on("click", "#nav-all", async function() {
    //Event handler for Navigation to Homepage
    hideElements();
    await generateAllStories();
    $allStoriesList.show();
  });
  $nav.on('click', '#nav-login', function() {
    //Event Handler for Clicking Login
    // Show the Login and Create Account Forms
    $loginForm.slideToggle();
    $createAccountForm.slideToggle();
    $allStoriesList.toggle();
    $submitForm.hide();
  });
  $nav.on('click', '#nav-welcome', function() {
    // Event Handler for clicking welcome
    hideMinorTabs(exclude=$welcome);
    $welcome.slideToggle();
  });
  $nav.on('click', '#nav-jobs', function() {
    // Event Handler for clicking welcome
    hideMinorTabs(exclude=$jobs);
    $jobs.slideToggle();
  });
  $nav.on('click', '.under-construction', function() {
    // Show construction page for non-functional nav links
    hideMinorTabs(exclude=$construction);
    $construction.slideToggle();
  });
  $nav.on('click', '#nav-submit', function() {
    // toggles new story form upon clicking "submit" tab
    hideMinorTabs(exlude=$submitForm);
    $submitForm.slideToggle();
  });
  $nav.on('click', '#nav-user-profile', function(){
    // handles toggle of user profile section when clicking
    // username in navbar
    hideMinorTabs(exclude=$userProfile);
    $userProfile.slideToggle();
  })
  $nav.on('click', '#nav-logout', function() {
    // Log Out Functionality
    // empty out local storage
    localStorage.clear();
    // refresh the page, clearing memory
    location.reload();
  });

  $loginForm.on("submit", async function(evt) {
  /**
   * Event listener for logging in.
   *  If successfully we will setup the user instance
   */
    evt.preventDefault(); // no page-refresh on submit

    // grab the username and password
    const username = $("#login-username").val();
    const password = $("#login-password").val();

    // call the login static method to build a user instance
    const userInstance = await User.login(username, password)
    .then(async(userInstance) => {
      // set the global user to the user instance
      currentUser = userInstance;
      syncCurrentUserToLocalStorage();
      loginAndSubmitForm();
      await generateAllStories();
    }).catch((e) => {
      showNotification(e.response.data.error.message);
    });
  });

  $createAccountForm.on("submit", async function(evt) {
  /**
   * Event listener for signing up.
   *  If successfully we will setup a new user instance
   */
    evt.preventDefault(); // no page refresh

    // grab the required fields
    let name = $("#create-account-name").val();
    let username = $("#create-account-username").val();
    let password = $("#create-account-password").val();

    // call the create method, which calls the API and then builds a new user instance
    const newUser = await User.create(username, password, name)
    .then(async (newUser)=> {
      currentUser = newUser;
      syncCurrentUserToLocalStorage();
      loginAndSubmitForm();
      await generateAllStories();
    }).catch((e) => {
      showNotification(e.response.data.error.message);
    });
  });


  $submitForm.on("submit", async function(evt) {
    // handles submission of new story form
    evt.preventDefault(); // no page refresh
    // grab the required fields
    let author = $('#author').val();
    let title = $('#title').val();
    let url = $('#url').val();
    const newStory = await storyList.addStory(currentUser, {author, title, url});
    generateAllStories();
    
    $submitForm.hide();
    $submitForm.trigger('reset');
  })

  $editArticleForm.on('submit', async function(evt) {
    // handles submission of edit story form
    evt.preventDefault(); // no page refresh
    if (!currentUser) return;
    // grab the required fields
    let storyId = $('#edit-story-id').val();
    let title = $('#edit-title').val();
    const updatedStory = await storyList.updateStory(currentUser, storyId, {title});
    await generateOwnStories();
    $editArticleForm.hide();
  })

  $('body').on('click', '.article-favorite', async function(evt){
    // handles logic for clicking 'favorite' button beside story
    if(!currentUser) return;
    const favoriteBtn = evt.target;
    const storyLi = favoriteBtn.parentElement;
    const {storyId} = storyLi.dataset;
    response = await currentUser.favoriteStory(storyId);
    await generateAllStories();
  })
  $('body').on('click', '.article-unfavorite', async function(evt){
    // handles logic for clicking 'unfavorite' button beside story
    if(!currentUser) return;
    const unfavoriteBtn = evt.target;
    const storyLi = unfavoriteBtn.parentElement;
    const {storyId} = storyLi.dataset;
    response = await currentUser.unfavoriteStory(storyId);
    await generateAllStories();
  })
  $('body').on('click', '.article-edit', async function(evt){
    // handles logic for clicking 'edit' button beside story
    if(!currentUser) return;
    const editBtn = evt.target;
    const storyLi = editBtn.parentElement;
    const {storyId} = storyLi.dataset;
    document.querySelector('#edit-story-id').value = storyId;
    document.querySelector('#edit-title').value = storyLi.querySelector('a').innerText;
    $editArticleForm.slideToggle();
  })
  $('body').on('click', '.article-delete', async function(evt){
    // handles logic for clicking 'delete' button beside story
    if(!currentUser) return;
    const deleteBtn = evt.target;
    const storyLi = deleteBtn.parentElement;
    const {storyId} = storyLi.dataset;
    response = await storyList.removeStory(currentUser, storyId);
    storyLi.remove();
  })



  async function checkIfLoggedIn() {
  /**
   * On page load, checks local storage to see if the user is already logged in.
   * Renders page information accordingly.
   */
    // let's see if we're logged in
    const token = localStorage.getItem("token");
    const username = localStorage.getItem("username");

    // if there is a token in localStorage, call User.getLoggedInUser
    //  to get an instance of User with the right details
    //  this is designed to run once, on page load
    currentUser = await User.getLoggedInUser(token, username);
    await generateAllStories();

    if (currentUser) {
      showContentForLoggedInUser();
      updateUserProfile();
      $favoriteStoriesList.show();
      $ownStoriesList.show();
    }
  }

  function loginAndSubmitForm() {
  /**
   * A rendering function to run to reset the forms and hide the login info
   */
    // hide the forms for logging in and signing up
    $loginForm.hide();
    $createAccountForm.hide();

    // reset those forms
    $loginForm.trigger("reset");
    $createAccountForm.trigger("reset");

    // show the stories
    $allStoriesList.show();
    $favoriteStoriesList.show();
    $ownStoriesList.show();

    // update the content visibilities
    showContentForLoggedInUser();
    // update the user profile section
    updateUserProfile();

  }

  async function generateAllStories() {
  /** 
   * A rendering function for stories in My Articles, My Favorites and
   * regular list. Priority for stories is My Articles > My Favorites > Normal
   */
    await generateNormalStories();
    generateOwnStories();
    generateFavoriteStories();
  }

  async function generateNormalStories() {
  /**
   * A rendering function to call the StoryList.getStories static method,
   *  which will generate a storyListInstance. Then render stories that
   *  don't go to My Favorites or My Articles lists
   */
    // get an instance of StoryList
    const storyListInstance = await StoryList.getStories();
    // update our global variable
    storyList = storyListInstance;
    let favoriteStoryIds = [];
    let ownStoryIds = [];
    if(currentUser){
      favoriteStoryIds = currentUser.favorites.map((s) => s.storyId);
      ownStoryIds = currentUser.ownStories.map((s) => s.storyId);
    }
    // empty out that part of the page
    $allStoriesList.empty();

    // loop through all of our stories and generate HTML for them
    // if they are neither favorited nor user's own story
    for (let story of storyList.stories) {
      const isFavorite = favoriteStoryIds.includes(story.storyId);
      const isOwn = ownStoryIds.includes(story.storyId);
      if(!(isFavorite || isOwn)){
        addStoryHTML(story, isFavorite, isOwn, isLoggedIn=!!currentUser, $allStoriesList);
      }
    }
  }
  function generateFavoriteStories(){
    // renders stories that go into favorite section

    // empty appropriate section of page
    $favoriteStoriesList.empty();
    if(!currentUser) return;
    // only add stories to favorites section if they don't go to
    // my articles section
    const ownStoryIds = currentUser.ownStories.map((s) => s.storyId);
    for (let story of currentUser.favorites){
      const isOwn = ownStoryIds.includes(story.storyId)
      if(!isOwn){
        addStoryHTML(story, isFavorite=true, isOwn, isLoggedIn=true, $favoriteStoriesList)
      }
    }
  }
  function generateOwnStories(){
    // renders stories that go into my articles section

    //empty appropriate section of page
    $ownStoriesList.empty();
    if(!currentUser) return;
    // check if article has been favorited to render favorite/unfavorite
    // button correctly
    const favoriteStoryIds = currentUser.favorites.map((s) => s.storyId);
    for(let story of currentUser.ownStories){
      addStoryHTML(
        story, 
        isFavorite=favoriteStoryIds.includes(story.storyId),
        isOwn=true, 
        isLoggedIn=true,
        $ownStoriesList);
    }
  }
  function addStoryHTML(story, isFavorite=false, isOwn=false, isLoggedIn=false, destinationList){
    // render story as list item of specified destination list with appropriate
    // favorite/unfavorite/edit/delete buttons
    const result = generateStoryHTML(
      story, 
      isFavorite,
      isOwn,
      isLoggedIn);
      destinationList.append(result);
  }


  function generateStoryHTML(story, isFavorite=false, isOwn=false, isLoggedIn=false) {
  /**
   * A function to render HTML for an individual Story instance
   */
    let hostName = getHostName(story.url);

    // render story markup
    const storyMarkup = $(`
      <li data-story-id="${story.storyId}">
        <a class="article-link" href="${story.url}" target="a_blank">
          <strong>${story.title}</strong>
        </a>
        <small class="article-author">by ${story.author}</small>
        <small class="article-hostname ${hostName}">(${hostName})</small>
        <small class="article-favorite ${(isFavorite || !isLoggedIn) ? 'hidden': ''}">[favorite]</small>
        <small class="article-unfavorite ${isFavorite ? '': 'hidden'}">[unfavorite]</small>
        <small class="article-edit ${isOwn ? '': 'hidden'}">{edit}</small>
        <small class="article-delete ${isOwn ? '': 'hidden'}">{delete}</small>
        <small class="article-username">posted by ${story.username} ${moment(story.createdAt).fromNow()}</small>
      </li>
    `);

    return storyMarkup;
  }


  function hideMinorTabs(exclude) {
    const elementsArr = [
      $submitForm,
      $editArticleForm,
      $loginForm,
      $userProfile,
      $createAccountForm,
      $construction,
      $welcome,
      $jobs
    ];
    elementsArr.forEach(($elem) => {
      if(!($elem === exclude)) {
        $elem.slideUp()
      } 
    });
  }
  function hideStories() {
    const elementsArr = [
      $allStoriesList,
      $filteredArticles,
      $ownStories,
      $favoriteStoriesList,
    ];
    elementsArr.forEach($elem => $elem.hide());
  }
  function hideElements() {
    hideStories();
    hideMinorTabs();
  }

  function showContentForLoggedInUser() {
    // make sections designed for logged in user visible
    showNavForLoggedInUser();
    $('.display-login-required').show();
  }
  function showNavForLoggedInUser() {
    // make navbar sections designed for logged in user visible
    $navLogin.hide();
    $navUserProfile.text(currentUser.username);
    $('.nav-login-required').show();
  }
  function updateUserProfile() {
    // update user profile section with current user info
    $('#profile-name').text(currentUser.name);
    $('#profile-username').text(currentUser.username);
    $('#profile-account-created-date').text(moment(currentUser.createdAt).fromNow());
    $('#profile-account-updated-date').text(moment(currentUser.updatedAt).fromNow());
  }



  function getHostName(url) {
  /* simple function to pull the hostname from a URL */
    let hostName;
    if (url.indexOf("://") > -1) {
      hostName = url.split("/")[2];
    } else {
      hostName = url.split("/")[0];
    }
    if (hostName.slice(0, 4) === "www.") {
      hostName = hostName.slice(4);
    }
    return hostName;
  }



  function syncCurrentUserToLocalStorage() {
  /* sync current user information to localStorage */
    if (currentUser) {
      localStorage.setItem("token", currentUser.loginToken);
      localStorage.setItem("username", currentUser.username);
    }
  }
});
