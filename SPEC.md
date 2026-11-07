# Counting Game — Version 1 Specification

## 1. Purpose

Create a very simple counting activity designed for independent use by a three-year-old on an iPad.

The activity should teach and practice counting visible objects and selecting the corresponding numeral.

The interface should be intentionally minimal and non-gamified.

## 2. Target Platform

* iPad
* Touch interaction
* Runs full-screen as an installable web app
* Works offline after installation
* No login required
* No external internet content
* No advertisements
* No links or menus accessible to the child

## 3. Session Structure

Each session contains exactly **10 questions**.

After the tenth question has been answered correctly, display:

# The End

Provide a large **Start Again** button below it.

Do not display a score.

## 4. Question Structure

Each question contains a quantity between **1 and 10**.

Use one type of countable object for the entire question.

Available object classes:

* Horse
* Rabbit
* Apple
* Carrot

Example:

🐇   🐇

🐇   🐇   🐇

**How many?**

[ 4 ]   [ 5 ]   [ 6 ]

## 5. Object Generation

For each question:

* Select one object type.
* Select a quantity from 1–10.
* Display exactly that many objects.
* Display objects in a consistent four-column grid, filling left to right and then top to bottom.
* Objects must not overlap or vary in position.
* Objects must remain easily distinguishable and countable.
* Tapping an object dims it to mark it as counted; tapping it again restores it.
* Counted state resets for every new question and does not affect answer behavior.

Across a 10-question session, quantities should be reasonably distributed rather than selected completely independently at random.

Avoid excessive repetition of the same quantity.

## 6. Answer Choices

Display exactly **three large numeral buttons**.

Requirements:

* One answer is correct.
* Two answers are incorrect.
* All three numbers must be distinct.
* All answers must be between 1 and 10.
* Incorrect choices should generally be numerically close to the correct answer.
* Randomize the position of the correct answer.

Example for a correct answer of 6:

[ 5 ]   [ 7 ]   [ 6 ]

## 7. Correct Answer Behavior

When the child taps the correct number:

1. Play a short, pleasant confirmation sound.
2. Display a brief celebratory star animation.
3. Do not accumulate stars, points, coins, badges, or other rewards.
4. After approximately 0.7–1.0 seconds, automatically advance to the next question.

The celebration should acknowledge success without becoming the primary attraction of the activity.

## 8. Incorrect Answer Behavior

When the child selects an incorrect number:

1. Keep the same question on screen.
2. Keep all three answer choices available.
3. Do not reveal the correct answer.
4. Do not remove the incorrect answer.
5. Provide a neutral spoken response:

**“Try again.”**

6. Allow the child to immediately select another answer.

The question advances only after the correct answer is selected.

## 9. Scoring and Tracking

Version 1 does **not** display or require scoring.

Internally tracking first-attempt accuracy is not necessary for Version 1.

No progress history, accounts, analytics, or parent dashboard are required.

## 10. Child Interface

The interface should contain only what is necessary for the current activity.

Each question screen should contain:

* A simple prompt such as **“How many?”**
* The objects to count
* Three large numeral buttons

Design requirements:

* Large touch targets
* Large objects
* Large numerals
* High visual clarity
* Generous spacing
* No scrolling
* No child-accessible navigation
* No settings
* No advertisements
* No progress bars
* No timers
* No characters giving instructions
* No reward economy
* No unnecessary animation

The child should be able to understand the basic interaction without being able to read.

## 11. Visual Style

The visual design should be calm and simple.

Use recognizable illustrations of:

* horses
* rabbits
* apples
* carrots
* unicorns
* clownfish
* ducks

Avoid visually busy backgrounds.

The objects should be substantially larger and more visually prominent than decorative elements.

Use stars only for the brief correct-answer animation.

## 12. Audio

Version 1 requires two audio behaviors:

**Correct answer**

* Short pleasant confirmation sound.

**Incorrect answer**

* Neutral spoken phrase: “Try again.”

Do not use continuous background music.

## 13. Technical Requirements

Build as a lightweight Progressive Web App suitable for installation on an iPad Home Screen.

Requirements:

* Touch-friendly
* Responsive to iPad screen dimensions
* Full-screen/standalone presentation when launched from the Home Screen
* Offline operation
* All images, audio, fonts, and application resources stored locally with the app
* No runtime dependence on an internet connection
* No server-side application required
* No user account
* No analytics
* No third-party advertising or tracking

## 14. Out of Scope for Version 1

Do **not** add:

* Addition or subtraction
* Counting aloud when objects are tapped
* Dragging objects
* Multiple object types within one question
* Adaptive difficulty
* Levels
* Scores
* Historical performance
* Parent dashboard
* User accounts
* Rewards
* Coins
* Badges
* Unlockable content
* Avatars
* Background music
* Menus
* Settings screens
* Online services

These can be considered in later versions after observing actual child use.

## 15. Definition of Done

Version 1 is complete when:

* It can be launched full-screen from an iPad Home Screen.
* It works without an internet connection.
* A child can complete a 10-question counting session entirely by touch.
* Every question contains 1–10 clearly countable objects.
* Every question presents three valid numeral choices.
* Incorrect answers result in “Try again” without advancing.
* Correct answers produce a brief sound/star response and advance automatically.
* Question 10 ends at a simple **“The End”** screen.
* The activity contains no menus, ads, logins, scores, or external content.
