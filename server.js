const express = require("express");
const mysql = require("mysql2/promise");
const axios = require("axios");
const {v4:uuid}=require('uuid')
const bcrypt=require('bcrypt')
const jwt=require('jsonwebtoken')
const cors=require('cors')
require('dotenv').config()

const app = express();
app.use(express.json())
app.use(cors())



// Configuration
const PORT = process.env.PORT || 3008
const DB_CONFIG = {
  host:'%',
  user: "upender", 
  password: process.env.DB_PASSWORD, 
  database: process.env.DB_DATABASE,
  waitForConnections: true,   
  connectionLimit: 10,

};

// Initialize MySQL Connection Pool
const pool = mysql.createPool(DB_CONFIG);


// Fetch Companies
app.get("/fetch-companies", async (req, res) => {
  const {offset}=req.query
  try {
    const response = await axios.get(
      `https://marketstack.com/stock_api.php?offset=${offset}&exchange=XNSE&search=`
    );
    if(response.data.data){
      const query=`insert into companies_stocks(name,ticker,exchange) values(?,?,?)`
      const connection = await pool.getConnection();
      for (let i of response.data.data){
        const symbol=i.symbol.split('.')[0]
        await connection.execute(query,[i.name,symbol,'NSE'])
      }
      connection.release()
      res.status(201)
      res.send({message:'stocks of companies stored.'})
    }
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ error: "An error occurred while fetching companies" });
  }
});

app.post('/api/signup', async (req, res) => {
  const { username, password, email } = req.body;
  const id = uuid();
  const connection = await pool.getConnection();
  try {
    const [user] = await connection.execute(`SELECT * FROM users WHERE email = ?`, [email]);
    if (user.length > 0) {
      return res.status(400).json({ error: 'Email already exists.' });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const query = `INSERT INTO users (id, username, password, email) VALUES (?, ?, ?, ?)`;
    await connection.execute(query, [id, username, hashedPassword, email]);
    res.status(201).json({ message: 'User signup successful. Try logging in.' });
  } catch (error) {
    res.status(500).json({ error:error});
  } finally {
    connection.release();
  }
});

app.post('/api/signin', async (req, res) => {
  const { email, password } = req.body;

  let connection;
  try {
    connection = await pool.getConnection();
    const [rows] = await connection.execute(`SELECT * FROM users WHERE email = ?`, [email]);
    if (rows[0].length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    const user = rows[0];
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    const token = jwt.sign(
      { id: user.id, username: user.username, email: user.email },
      process.env.SECRET_KEY,
    );
    res.status(200).json({ message: 'Login successful', token });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

// Test route
app.get('/', (req, res) => {
  res.send('Hello World!');
});

// Start the Server
app.listen(PORT, async () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
