const BASE_URL = "https://hack-or-snooze-v3.herokuapp.com";

/**
 * This class maintains the list of individual Story instances
 *  It also has some methods for fetching, adding, and removing stories
 */

class StoryList {
  constructor(stories) {
    this.stories = stories;
  }

  /**
   * This method is designed to be called to generate a new StoryList.
   *  It:
   *  - calls the API
   *  - builds an array of Story instances
   *  - makes a single StoryList instance out of that
   *  - returns the StoryList instance.*
   */

  static async getStories() {
    // query the /stories endpoint (no auth required)
    const response = await axios.get(`${BASE_URL}/stories`);

    // turn the plain old story objects from the API into instances of the Story class
    const stories = response.data.stories.map(story => new Story(story));

    // build an instance of our own class using the new array of stories
    const storyList = new StoryList(stories);
    return storyList;
  }

  async addStory(user, newStory) {
    /**
    * Method to make a POST request to /stories and add the new story to the list
    * - user - the current instance of User who will post the story
    * - newStory - a new story object for the API with title, author, and url
    *
    * Returns the new story object
    */
    if (!user) throw new Error('A user must be logged in to add stories!');
    const response = await axios({
      url: `${BASE_URL}/stories`,
      data: {
        token: user.loginToken,
        story: newStory
      },
      method: 'POST'
    })
    const newStoryInstance = new Story(response.data.story);
    this.stories.push(newStoryInstance);
    user.synchronizeData();
    return newStoryInstance;
  }
  async updateStory(user, storyId, updatedStory){
    /**
    * Method to make a PATCH request to /stories to update exisitng story
    * - user - the current instance of User who will post the story
    * - storyId - the id of the existing story to update
    * - updatedStory - an updated story object for the API with new title
    *
    * Returns the new story object
    */
    if(!user) throw new Error('A user must be logged in to update stories!');
    const ownStoryIds = user.ownStories.map((s) => s.storyId);
    if(!ownStoryIds.includes(storyId)) return "story not current user's";
    const response = await axios({
      url: `${BASE_URL}/stories/${storyId}`, 
      data: {
        token: user.loginToken,
        story: updatedStory
      },
      method: 'PATCH'
    });
    const updatedStoryInstance = new Story(response.data.story);
    this.stories[this.stories.findIndex((s) => (s.storyId === storyId))] = updatedStoryInstance;
    await user.synchronizeData();
    return updatedStoryInstance;
  }
  async removeStory(user, storyId) {
    /**
    * Method to make a DELETE request to /stories to remove exisitng story
    * - user - the current instance of User who will post the story
    * - storyId - the id of the existing story to update
    *
    * Returns the related response message
    */
    if(!user) throw new Error('A user must be logged in to remove stories!');
    const ownStoryIds = user.ownStories.map((s) => s.storyId);
    if(!ownStoryIds.includes(storyId)) return "story not current user's";
    const response = await axios({
      url: `${BASE_URL}/stories/${storyId}`, 
      data: {
        token: user.loginToken
      },
      method: 'DELETE'
    });
    this.stories = this.stories.filter((s) => (s.storyId !== storyId))
    user.synchronizeData();
    return response.data.message;
  }
}


/**
 * The User class to primarily represent the current user.
 *  There are helper methods to signup (create), login, and getLoggedInUser
 */

class User {
  constructor(userObj) {
    this.username = userObj.username;
    this.name = userObj.name;
    this.createdAt = userObj.createdAt;
    this.updatedAt = userObj.updatedAt;

    // these are all set to defaults, not passed in by the constructor
    this.loginToken = "";
    this.favorites = [];
    this.ownStories = [];
  }


  async favoriteStory(storyId){
    // Adds story with storyId to favorite list
    // Makes POST request to API and returns user instance
    const response = await axios({
      url: `${BASE_URL}/users/${this.username}/favorites/${storyId}`, 
      data: {
      token: this.loginToken
      },
      method: 'POST'
    });
    await this.synchronizeData();
    return this;
  }
  async unfavoriteStory(storyId){
    // Removes story with storyId from favorite list
    // Makes DELETE request to API and returns user instance
    const response = await axios({
      url: `${BASE_URL}/users/${this.username}/favorites/${storyId}`, 
      data: {
      token: this.loginToken
      },
      method: 'DELETE'
    });
    await this.synchronizeData();
    return this;
  }

  static async create(username, password, name) {
   /* Create and return a new user.
   *
   * Makes POST request to API and returns newly-created user.
   *
   * - username: a new username
   * - password: a new password
   * - name: the user's full name
   */

    const response = await axios.post(`${BASE_URL}/signup`, {
      user: {
        username,
        password,
        name
      }
    });

    // build a new User instance from the API response
    const newUser = new User(response.data.user);

    // attach the token to the newUser instance for convenience
    newUser.loginToken = response.data.token;

    return newUser;
  }

  static async login(username, password) {
   /* Login in user and return user instance.

   * - username: an existing user's username
   * - password: an existing user's password
   */
    const response = await axios.post(`${BASE_URL}/login`, {
      user: {
        username,
        password
      }
    });

    // build a new User instance from the API response
    const existingUser = new User(response.data.user);

    // instantiate Story instances for the user's favorites and ownStories
    existingUser.favorites = response.data.user.favorites.map(s => new Story(s));
    existingUser.ownStories = response.data.user.stories.map(s => new Story(s));

    // attach the token to the newUser instance for convenience
    existingUser.loginToken = response.data.token;

    return existingUser;
  }

  static async getLoggedInUser(token, username) {
   /** Get user instance for the logged-in-user.
   *
   * This function uses the token & username to make an API request to get details
   *   about the user. Then it creates an instance of user with that info.
   */
    // if we don't have user info, return null
    if (!token || !username) return null;

    // call the API
    const response = await axios.get(`${BASE_URL}/users/${username}`, {
      params: {
        token
      }
    });

    // instantiate the user from the API information
    const existingUser = new User(response.data.user);

    // attach the token to the newUser instance for convenience
    existingUser.loginToken = token;

    // instantiate Story instances for the user's favorites and ownStories
    existingUser.favorites = response.data.user.favorites.map(s => new Story(s));
    existingUser.ownStories = response.data.user.stories.map(s => new Story(s));
    return existingUser;
  }
  async synchronizeData() {
    const response = await axios.get(`${BASE_URL}/users/${this.username}`, {
      params: {
        token: this.loginToken
      }
    });
    const userData = response.data.user;
    this.createdAt = userData.createdAt;
    this.updatedAt = userData.updatedAt;
    this._updateFavorites(userData);
    this._updateOwnStories(userData);
    return this
  }
  _updateFavorites(userData){
    // updates favorite list of user instance
    // using user data returned from API
    this.favorites = userData.favorites.map(s => new Story(s));
  }
  _updateOwnStories(userData){
    // updates own stories list of user instance
    // using user data returned from API
    this.ownStories = userData.stories.map(s => new Story(s));
  }

}

/**
 * Class to represent a single story.
 */

class Story {

  /**
   * The constructor is designed to take an object for better readability / flexibility
   * - storyObj: an object that has story properties in it
   */

  constructor(storyObj) {
    this.author = storyObj.author;
    this.title = storyObj.title;
    this.url = storyObj.url;
    this.username = storyObj.username;
    this.storyId = storyObj.storyId;
    this.createdAt = storyObj.createdAt;
    this.updatedAt = storyObj.updatedAt;
  }
}