import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import dotenv from "dotenv";

const app = express();
const port = 4000;
dotenv.config();
const { Pool } = pg;
const connectionString = process.env.DATABASE_URL;

const db = new Pool({
  connectionString: connectionString,
  ssl: {
    rejectUnauthorized: false, // This line may be necessary for some environments
  },
});

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

let currentUserId = 1;

async function checkVisited() {
  const result = await db.query("SELECT country_code FROM visited_countries WHERE user_id = $1", [currentUserId]);
  let countries = result.rows.map(country => country.country_code);
  return countries;
}

async function getCurrentUser() {
  const result = await db.query("SELECT * FROM users WHERE id = $1", [currentUserId]);
  return result.rows[0];
}

async function getAllUsers() {
  const result = await db.query("SELECT * FROM users");
  return result.rows;
}

app.get("/", async (req, res) => {
  try {
    const countries = await checkVisited();
    const currentUser = await getCurrentUser();
    const allUsers = await getAllUsers();

    const color = currentUser ? currentUser.color : '#ffffff'; // Default color if not found

    res.render("index.ejs", {
      countries: countries,
      total: countries.length,
      users: allUsers,
      color: color,
      error: null,
    });
  } catch (err) {
    console.error("Error rendering index:", err);
    res.render("index.ejs", {
      countries: [],
      total: 0,
      users: [],
      error: "Error fetching data",
      color: '#ffffff', // Default color in case of error
    });
  }
});



app.post("/add", async (req, res) => {
  const input = req.body["country"];

  if (!input || input.trim() === "") {
    const countries = await checkVisited();
    const currentUser = await getCurrentUser();
    const allUsers = await getAllUsers();
    const color = currentUser ? currentUser.color : '#ffffff'; // Default color if not found
    res.render("index.ejs", {
      countries: countries,
      total: countries.length,
      users: allUsers,
      color: color,
      error: "Country name cannot be empty, please try again",
    });
    return;
  }

  try {
    const result = await db.query(
      "SELECT country_code FROM countries WHERE LOWER(country_name) LIKE '%' || $1 || '%';",
      [input.toLowerCase()]
    );

    if (result.rows.length === 0) {
      throw new Error("Country not found");
    }

    const data = result.rows[0];
    let countryCode = data.country_code;

    if (countryCode === "IO") {
      countryCode = "IN";
    }

    const checkResult = await db.query(
      "SELECT * FROM visited_countries WHERE country_code = $1 AND user_id = $2",
      [countryCode, currentUserId]
    );

    if (checkResult.rows.length > 0) {
      const countries = await checkVisited();
      const currentUser = await getCurrentUser();
      const allUsers = await getAllUsers();
      const color = currentUser ? currentUser.color : '#ffffff'; // Default color if not found
      res.render("index.ejs", {
        countries: countries,
        total: countries.length,
        users: allUsers,
        color: color,
        error: "Country already added, try again"
      });
    } else {
      await db.query(
        "INSERT INTO visited_countries (country_code, user_id) VALUES ($1, $2)",
        [countryCode, currentUserId]
      );
      res.redirect("/");
    }
  } catch (err) {
    console.error(err);
    const countries = await checkVisited();
    const currentUser = await getCurrentUser();
    const allUsers = await getAllUsers();
    const color = currentUser ? currentUser.color : '#ffffff'; // Default color if not found
    res.render("index.ejs", {
      countries: countries,
      total: countries.length,
      users: allUsers,
      color: color,
      error: "Country name does not exist, try again"
    });
  }
});

app.post("/user", async (req, res) => {
  if (req.body.add === "new") {
    res.render("new.ejs");
  } else {
    currentUserId = req.body.user;
    res.redirect("/");
  }
});

app.post("/new", async (req, res) => {
  const name = req.body["name"];
  const color = req.body.color;

  if (!name || name.trim() === "") {
    const countries = await checkVisited();
    const currentUser = await getCurrentUser();
    const allUsers = await getAllUsers();
    const color = currentUser ? currentUser.color : '#ffffff'; // Default color if not found
    res.render("index.ejs", {
      countries: countries,
      total: countries.length,
      users: allUsers,
      color: color,
      error: "Name cannot be empty, please try again"
    });
    return;
  }

  try {
    const newMember = await db.query(
      "INSERT INTO users (name, color) VALUES($1, $2) RETURNING * ",
      [name, color]
    );
    const newId = newMember.rows[0].id;
    currentUserId = newId;
    res.redirect("/");
  } catch (err) {
    console.error(err);
    const countries = await checkVisited();
    const currentUser = await getCurrentUser();
    const allUsers = await getAllUsers();
    const color = currentUser ? currentUser.color : '#ffffff'; // Default color if not found
    res.render("index.ejs", {
      countries: countries,
      total: countries.length,
      users: allUsers,
      color: color,
      error: "Error adding new member, try again"
    });
  }
});

app.post("/delete", async (req, res) => {
  if (currentUserId) {
    try {
      await db.query("DELETE FROM visited_countries WHERE user_id = $1", [currentUserId]);
      await db.query("DELETE FROM users WHERE id = $1", [currentUserId]);
      res.redirect("/");
    } catch (err) {
      console.error(err);
      const countries = await checkVisited();
      const currentUser = await getCurrentUser();
      const allUsers = await getAllUsers();
      const color = currentUser ? currentUser.color : '#ffffff'; // Default color if not found
      res.render("index.ejs", {
        countries: countries,
        total: countries.length,
        users: allUsers,
        color: color,
        error: "Error deleting user data, try again"
      });
    }
  } else {
    const countries = await checkVisited();
    const currentUser = await getCurrentUser();
    const allUsers = await getAllUsers();
    const color = currentUser ? currentUser.color : '#ffffff'; // Default color if not found
    res.render("index.ejs", {
      countries: countries,
      total: countries.length,
      users: allUsers,
      color: color,
      error: "No user selected, try again"
    });
  }
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
