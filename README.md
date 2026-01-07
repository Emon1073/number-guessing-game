# number-guessing-game


A web-based Number Guessing Game built with **Flask**, **JavaScript**, **HTML**, and **CSS**.

## Features
- User login & account creation
- Multiple difficulty levels
- Leaderboard with player statistics
- Performance charts (win %, games, time)
- Fully responsive (desktop, tablet, mobile)

## Project Structure
number-guessing-game/
│── app.py
│── templates/
│   └── index.html
│── static/
│   ├── app.js
│   └── style.css
│── .gitignore
│── README.md


## For run it Locally
1:
git clone https://github.com/Emon1073/number-guessing-game.git
cd number-guessing-game


2: 
pip install flask


if pip doesnot work,

python -m pip install flask

3:
run the game: python app.py

Run it locally: http://127.0.0.1:5000




##How the Game Works

1.User logs in or creates a new account

2.Select a difficulty level:

3.Easy → smaller range, more guesses

4.Extreme → larger range, fewer guesses

5.Guess the number within the allowed attempts

6.Earn points based on difficulty and remaining tries

7.Performance and leaderboard update automatically



##Educational Purpose

This project demonstrates:

Flask API routing

Frontend ↔ backend communication

Game logic and state management

Data persistence using JSON

Responsive UI design

Git & GitHub workflow

## Future Improvements (Optional)

Online deployment (Render / Railway)

Password-protected accounts

Multiplayer mode

Database integration (SQLite)

Game animations and sound effects

👤 Author

Emon Ahmed

Scientific Programming – Winter 2026

Infotronic System Engineering (HSRW)



