# Product Requirements Document: Locks of the Week

## 1. App Overview and Objectives

**Overview:** "Locks of the Week" is a responsive web application designed for a private group of approximately 25 users to participate in a 20-week American football (NFL and NCAA) betting pool. Each week, users will select three betting outcomes (against the point spread or total points) for upcoming games. The application will track picks, calculate weekly results, display weekly leaderboards, and maintain overall season standings. A key feature is the ability for users to submit "trash talk" messages related to their picks, which will be emailed to administrators.

**Objectives:**
* Provide a user-friendly platform for making and tracking weekly football betting picks.
* Automate the collection of game data and results.
* Foster a fun and engaging experience through weekly competitions and social interaction (via trash talk emails).
* Enable administrators to manage users and league participation.
* Ensure transparency by allowing users to view all submitted picks after they have finalized their own for the week.
* Maintain accurate weekly and overall standings.

## 2. Target Audience

* A private group of approximately 25 friends/colleagues.
* Users are familiar with sports betting concepts (point spreads, totals).
* Users will access the application from both desktop and mobile devices.
* Administrators (also users) who will manage the league and participants.

## 3. Core Features and Functionality

### 3.1. User Account Management
    * **Feature: User Registration**
        * Users can create an account using an email address and password.
        * Registration is restricted: only email addresses pre-registered by an Admin can successfully create an account.
        * **Acceptance Criteria:**
            * A user attempting to register with a non-pre-registered email sees the message: "This email is not authorized for account creation. Please contact an administrator."
            * Successful registration redirects the user to the login page or directly into the app.
    * **Feature: User Login**
        * Registered users can log in using their email and password.
        * Integration with Firebase Authentication for Google Single Sign-On (SSO) option.
        * **Acceptance Criteria:**
            * Successful login grants access to the application's features.
            * Failed login attempts display an appropriate error message.
    * **Feature: User Logout**
        * Logged-in users can securely log out of the application.
        * **Acceptance Criteria:**
            * Logout invalidates the user's session and redirects to the login page.

### 3.2. Admin - User Management
    * **Feature: Admin Dashboard for User Management**
        * Admins have access to a dedicated section to manage user profiles.
        * Displays a list of all registered or pre-registered users.
        * **Acceptance Criteria:**
            * Only users with the 'admin' role can access this section.
    * **Feature: Pre-register User Emails**
        * Admins can add email addresses to a whitelist, allowing users with these emails to register.
        * **Acceptance Criteria:**
            * Admin can input and save new email addresses to the system.
    * **Feature: Manage User Profiles**
        * Admins can view and edit the following for each user:
            * Name
            * Venmo Handle
            * Dues Paid (Yes/No - Boolean)
            * Date Dues Paid (Date)
        * Email address serves as the unique identifier and is not editable by admins after account creation.
        * Admins can view user pick status for the current week:
            * "Picks Submitted for Current Week" (Yes/No)
            * "Number of Picks Made This Week" (X/3)
        * **Acceptance Criteria:**
            * Admin can successfully update the manageable fields for any user.
            * Pick status information is accurately displayed.

### 3.3. Pick Selection
    * **Feature: Weekly Game Listing & Pick Interface**
        * Displays NFL and NCAA football games for the current active week, fetched via an internal microservice from The Odds API.
        * Games are displayed with Away Team, Home Team, Date & Time.
        * For each game, users can select:
            * Away Team to cover the spread (e.g., "ARI +3.5")
            * Home Team to cover the spread (e.g., "NE -7")
            * Total points Over (e.g., "OVER 44.5")
            * Total points Under (e.g., "UNDER 44.5")
        * The specific odds/lines are provided by the game data microservice; no bookmaker prioritization logic is needed in the front-end.
        * Users can select up to 3 picks in total across all available games for the week.
        * A counter displays the number of picks made out of 3 (e.g., "Picks: 1/3").
        * **Acceptance Criteria:**
            * All available games for the current week are displayed with their respective betting options.
            * Users can select and deselect picks via checkboxes.
            * The picks counter updates accurately.
            * If a game's `commence_time` has passed, betting options for that game are disabled or visually indicated as locked.
    * **Feature: Progressive Pick Submission**
        * Users can submit 1, 2, or 3 picks at a time using a "Submit Picks" button.
        * Each submission finalizes those specific picks. Submitted picks are locked and **cannot** be changed by the user.
        * If a user has submitted fewer than 3 picks, they can return to the pick selection page to make and submit their remaining picks for the week.
        * The interface should clearly show previously submitted (locked) picks for the current week.
        * **Acceptance Criteria:**
            * "Submit Picks" button saves the currently selected valid picks to the database.
            * Submitted picks are non-editable.
            * Users can make subsequent submissions until 3 picks are made for the week.
            * The system prevents submission of more than 3 picks per week.
    * **Feature: Trash Talk Submission**
        * Immediately after a user successfully submits their 3rd pick for the week, they are prompted to submit trash talk messages.
        * Interface to allow one message per each of their three picks, and one overall message for the week.
        * These messages are sent to an external email microservice. They are NOT stored within this application.
        * **Acceptance Criteria:**
            * Prompt appears only after the 3rd pick is finalized.
            * User can input messages for each pick and an overall message.
            * Submitting the messages successfully calls the external email microservice API.

### 3.4. View Picks & Standings
    * **Feature: View All Picks (Weekly Leaderboard)**
        * Accessible only after a user has submitted all 3 of their own picks for the current week.
        * Displays a table of all users' picks for the current (or selected historical) week.
        * Layout based on `image_fa0adc.jpg`:
            * Rows sorted alphabetically by User Name.
            * Columns for each of the 3 picks, showing: League, Away Team Abbr., Away Score, Home Team Abbr., Home Score, Pick Details (Lock + Line/Odds), and W/L/T Result (color-coded).
        * Game scores and pick results (W/L/T) are updated hourly via the scores microservice.
        * Users can select to view past weeks' leaderboards.
        * **Acceptance Criteria:**
            * Page is inaccessible until user's 3 picks are submitted.
            * All data elements per pick are displayed accurately as per `image_fa0adc.jpg`.
            * Results (scores, W/L/T) update as the database is updated by the scores microservice.
            * Historical week navigation functions correctly.
    * **Feature: Overall Standings Page**
        * Displays the season-long standings for all users.
        * Information displayed: Rank, User Name, Overall Record (W-L-T), Win Percentage, Total Wins ("Points"), Paid Status (Yes/No), Change in Rank from previous week.
        * Ranking logic: 1. Total Wins (desc), 2. Total Ties (desc), 3. Total Losses (asc).
        * Win Percentage calculated as: $(Wins + (0.5 \times Ties)) / Total Games Played$.
        * "Paid" status is view-only here.
        * Users can select to view overall standings as of any previous completed week.
        * **Acceptance Criteria:**
            * All users are listed with their correct standings data.
            * Ranking order is implemented correctly.
            * Win percentage is calculated correctly.
            * Paid status is displayed.
            * Change in rank is accurate.
            * Historical week view (for overall standings) functions correctly.

### 3.5. System & Data Management
    * **Feature: Define Active Week**
        * System needs a mechanism (admin controlled or automated by date) to set the "current active week" (1-20) for which picks are being made.
        * **Acceptance Criteria:**
            * Pick selection page loads games for the correct active week.
    * **Feature: Game Data Ingestion**
        * Relies on an existing microservice to fetch game data (teams, start times, lines) from The Odds API and store it in MongoDB.
        * **Acceptance Criteria:**
            * Application correctly reads and displays this data.
    * **Feature: Score Ingestion & Pick Resolution**
        * Relies on a new microservice (to be built) to fetch game results from The Odds API.
        * This microservice (or a related backend process) will compare submitted picks against game outcomes and the specific line picked to determine Win/Loss/Tie for each pick.
        * Results are stored in the database.
        * **Acceptance Criteria:**
            * Pick W/L/T status is accurately determined and stored.

## 4. Technical Stack Recommendations

* **Front-End:** React (using Vite for project setup), styled with Tailwind CSS.
* **User Authentication:** Firebase Authentication (Email/Password and Google SSO).
* **Database:** MongoDB (accessible by the application and microservices).
* **Backend/API:** Node.js with Express.js (or similar framework if building a dedicated backend for the app logic, could also be serverless functions). This will handle business logic, interact with Firebase for user roles, and interface with MongoDB.
* **Hosting:**
    * **Front-End:** Firebase Hosting (integrates well with Firebase Auth and React apps).
    * **Backend API/Logic:** Google Cloud Run (for containerized Node.js application).
    * **MongoDB:** Existing setup (e.g., MongoDB Atlas hosted on GCP for proximity).
* **Microservices:**
    * Game Data Service: Existing (assumed Python/Node.js, interacts with MongoDB).
    * Scores Service: To be built (assumed Python/Node.js, interacts with The Odds API and MongoDB).
    * Email Service: Existing (for trash talk).
* **Version Control:** Git (e.g., GitHub, GitLab).
* **Error Tracking (Future Priority):** Sentry.io.

## 5. Conceptual Data Model (MongoDB Collections)

* **`users` Collection:**
    * `_id`: ObjectId (Primary Key)
    * `firebaseUid`: String (UID from Firebase Auth, indexed)
    * `email`: String (unique, indexed)
    * `firstName`: String
    * `lastName`: String
    * `role`: String ('user' or 'admin', default: 'user')
    * `venmoHandle`: String (optional)
    * `duesPaid`: Boolean (default: false)
    * `dateDuesPaid`: Date (optional)
    * `createdAt`: Timestamp
    * `updatedAt`: Timestamp
* **`games` Collection:** (Managed by game data microservice, referenced by this app)
    * `_id`: ObjectId (Primary Key)
    * `gameApiId`: String (Unique ID from The Odds API, indexed)
    * `sportKey`: String (e.g., 'americanfootball_nfl', 'americanfootball_ncaaf')
    * `commenceTime`: Date (UTC)
    * `homeTeam`: String
    * `awayTeam`: String
    * `weekNumber`: Integer (e.g., 1 to 20, relevant to the season pool)
    * `bookmakers`: Array (embedded, containing market lines from The Odds API)
        * `key`: String (e.g., 'draftkings', 'fanduel')
        * `markets`: Array
            * `key`: String ('spreads', 'totals')
            * `outcomes`: Array
                * `name`: String (Team name for spreads, 'Over'/'Under' for totals)
                * `point`: Number (Spread value or Total value)
                * `price`: Number
    * `homeScore`: Number (optional, updated by scores service)
    * `awayScore`: Number (optional, updated by scores service)
    * `status`: String (e.g., 'scheduled', 'in_progress', 'final')
* **`picks` Collection:**
    * `_id`: ObjectId (Primary Key)
    * `userId`: ObjectId (references `users._id`, indexed)
    * `weekNumber`: Integer (1-20, indexed)
    * `gameId`: ObjectId (references `games._id` or `games.gameApiId` for linking, indexed)
    * `marketKey`: String (e.g., 'spreads', 'totals')
    * `selectedTeamName`: String (optional, relevant for spreads, e.g., 'Penn State Nittany Lions')
    * `selectedOutcomeName`: String (e.g., 'Penn State Nittany Lions' for spread, 'Over' for total)
    * `selectedOutcomePoint`: Number (The point spread or total picked, e.g., +2.5 or 44.5)
    * `pickedAtLine`: Number (The specific line value the pick was made against, e.g. if user picked Home +7, this is +7)
    * `submissionTime`: Timestamp
    * `result`: String ('W', 'L', 'T', 'Pending', indexed)
    * `trashTalkMessage`: String (optional, if deciding to store a copy even if emailed - *current requirement is NOT to store*)
* **`weeklyStandings` Collection:** (Optional, can be derived, but might optimize reads)
    * `_id`: ObjectId
    * `userId`: ObjectId (references `users._id`)
    * `weekNumber`: Integer
    * `wins`: Integer
    * `losses`: Integer
    * `ties`: Integer
* **`overallStandings` Collection:** (Optional, can be derived, but might optimize reads)
    * `_id`: ObjectId
    * `userId`: ObjectId (references `users._id`)
    * `seasonYear`: Integer (e.g., 2024)
    * `totalWins`: Integer
    * `totalLosses`: Integer
    * `totalTies`: Integer
    * `winPercentage`: Float
    * `rank`: Integer
    * `previousRank`: Integer

## 6. UI Design Principles

* **Platform:** Responsive Web Application (Desktop, Tablet, Mobile).
* **Overall Feel:** Clean, data-centric, intuitive, and user-friendly.
* **Navigation:** Persistent navigation bar (e.g., top bar collapsing to a hamburger menu on mobile) providing access to: Make Picks, Weekly Picks, Overall Standings, Admin (conditional), and Logout.
* **Pick Selection Screen (`gemini_sample.html` as reference):** Table-based layout for games, clear checkboxes for picks, prominent display of picks counter. Visual cues for locked games.
* **Weekly Leaderboard (`image_fa0adc.jpg` as reference):** Tabular display, alphabetical user sorting, color-coded W/L/T results. Clear presentation of each pick's details and associated game scores.
* **Overall Standings (Google Sheet example as reference):** Clear ranking, W-L-T records, win percentages, and other relevant data points in a tabular format.
* **Admin Pages:** Consistent clean and data-centric design, with straightforward forms and tables for user management.
* **Login Page:** Simple, clean interface for email/password login and Google SSO button.
* **Accessibility:** Aim for good contrast, keyboard navigability, and clear focus indicators as best practice.

## 7. Security Considerations

* **Authentication:** All pages (except Login/Registration) require authentication. Firebase Authentication will handle secure password storage, session management, and OAuth 2.0 for Google SSO.
* **Authorization:**
    * Backend API endpoints must validate user sessions.
    * Admin-specific functionalities (routes and API calls) must be protected and only accessible to users with the 'admin' role. Role checks should be performed on the backend.
* **Input Validation:** All user inputs (forms, API requests) must be validated on both client-side (for UX) and server-side (for security) to prevent common web vulnerabilities (e.g., XSS, injection).
* **Data Security:**
    * Use HTTPS for all communication.
    * Store sensitive data (if any beyond PII managed by Firebase) securely.
    * Be mindful of data exposure in API responses; only send necessary data to the client.
* **Microservice Communication:** Secure communication between the main application and internal microservices (e.g., using API keys, mutual TLS, or VPC private networking if applicable within GCP).
* **Dependencies:** Keep server-side and client-side libraries up-to-date to patch known vulnerabilities.

## 8. Development Phases/Milestones (Suggested)

* **Phase 1: Core Setup & User Authentication (MVP Foundation)**
    * Project setup (React with Vite, Node.js backend).
    * Firebase Authentication integration (Email/Password, Google SSO).
    * User registration (with admin pre-registration check).
    * Basic navigation structure.
    * Admin ability to pre-register emails.
    * Deployment pipeline setup for front-end (Firebase Hosting) and back-end (Firebase).
* **Phase 2: Pick Selection & Submission**
    * Develop Pick Selection page UI.
    * Integrate with game data microservice to display weekly games.
    * Implement logic for selecting up to 3 picks.
    * Implement pick submission (1-3 picks at a time) and saving to MongoDB.
    * Implement pick locking (no changes after submission).
    * Enforce game start time deadlines for picking.
* **Phase 3: Weekly Leaderboard & Results**
    * Develop "View All Picks" (Weekly Leaderboard) page UI.
    * Integrate with scores microservice (or develop functionality) to determine W/L/T for picks.
    * Display game scores and pick results.
    * Implement access restriction (user must have submitted 3 picks).
    * Implement historical week viewing for leaderboards.
* **Phase 4: Overall Standings & Admin Enhancements**
    * Develop Overall Standings page UI.
    * Implement logic for calculating overall records, win percentages, and ranking.
    * Implement historical overall standings viewing.
    * Full Admin User Management UI (edit name, paid status, Venmo, view pick status).
* **Phase 5: Trash Talk & Final Polish**
    * Implement trash talk submission UI and integration with email microservice.
    * Thorough testing across desktop and mobile.
    * UI polishing and bug fixing.
    * Documentation (basic).

## 9. Potential Challenges and Solutions

* **Challenge:** Coordinating front-end (React) with backend (Node.js API) and multiple microservices.
    * **Solution:** Define clear API contracts (request/response schemas) early. Use tools like Postman/Insomnia for API testing. Maintain good communication if different developers are working on different parts.
* **Challenge:** Real-time / near real-time updates for scores on the Weekly Leaderboard.
    * **Solution:** The hourly poll by the scores microservice is a good approach. The front-end can either poll the application's backend for updates or implement a simple refresh mechanism. WebSockets could be an option for true real-time but add complexity likely unnecessary for this scale/frequency.
* **Challenge:** Accurately calculating W/L/T for various pick types against game outcomes.
    * **Solution:** Thoroughly test the logic for comparing picks (spreads, totals) against game scores and the specific lines picked. Create a comprehensive set of test cases.
* **Challenge:** Managing weekly state transitions (e.g., current week for picking, viewing results for current/past weeks).
    * **Solution:** Implement robust logic for determining the "current active week." Ensure database queries for picks, games, and results are correctly filtered by `weekNumber`.
* **Challenge:** Ensuring responsive design works well across all target devices.
    * **Solution:** Use Tailwind CSS's responsive prefixes effectively. Test regularly on different browser sizes and actual mobile devices during development.
* **Challenge (User-Identified):** Dynamically serving historical weekly pages.
    * **Solution:** As discussed, parameterize views by `weekNumber`. Backend API endpoints should accept `weekNumber` to fetch the correct historical data. Front-end routing will handle `/:weekNumber` in URLs for these views.

## 10. Potential Costs

* **Firebase Authentication:** Free tier likely sufficient for ~25 users.
* **The Odds API:** Existing cost, dependent on usage by microservices.
* **Google Cloud Platform (Hosting):**
    * **Firebase Hosting:** Generous free tier for static assets.
    * **Cloud Run:** Generous free tier for containerized backend.
    * **MongoDB:** If using MongoDB Atlas, a free tier (M0) is available. If self-hosting on GCP, Compute Engine costs would apply (though likely minimal for this scale if optimized).
* **Domain Name:** Small annual fee ($10-20) if a custom domain is used.
* **Overall:** For ~25 users, the application can likely operate within the free tiers of these recommended services, with The Odds API being the primary known external cost.

## 11. Future Expansion Possibilities

* **In-App Trash Talk Display:** Store and display trash talk messages within the application (e.g., on the weekly leaderboard), potentially with basic moderation.
* **Sentry.io Integration:** Implement Sentry for error tracking and monitoring (marked as lower priority for MVP).
* **Enhanced Admin Dashboard:** More analytics for admins (e.g., pick patterns, user engagement).
* **Automated Weekly Rollover:** Automate the process of setting the "current active week."
* **User Profile Page:** Allow users to view their own historical picks and stats.
* **Notifications:** Email or in-app notifications (e.g., reminders to make picks, weekly results summary).
* **Support for Other Sports/Leagues:** Expand beyond NFL/NCAAF.
* **Multiple Pools/Leagues:** Allow a single instance of the app to host multiple private leagues.