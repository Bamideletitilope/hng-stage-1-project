
const express = require('express');
const router = express.Router();
const axios = require('axios');
//const cors = require('cors');
const pool = require('../database/db');
const { v7: uuidv7 } = require('uuidv7');



/*const app = express();
app.use(express.json());
app.use(cors());*/



router.post('/profiles', async (req, res) => {
    try{ 
        const { name } = req.body;

    // Missing name parameter
    if (!name ||typeof name !== 'string') {
        return res.status(422).json({
            status: "error",
            message: "Name must be a string"
        });
    }

    const cleanName = name.trim().toLowerCase();

    if (!cleanName) {
        return res.status(400).json({ 
            status: "error",
            message: "Name is required"
        });
    }
    //IDEMPOTENCY CHECK
    const existing = await pool.query(
    "SELECT * FROM profiles WHERE name = $1",
    [cleanName]
);

if (existing.rows.length > 0) {
    return res.json({
        status: "success",
        message: "Profile already exists",
        data: existing.rows[0]
    });
}

    const [genderRes, ageRes, countryRes] = await Promise.all([
        axios.get(`https://api.genderize.io/?name=${cleanName}`),
        axios.get(`https://api.agify.io/?name=${cleanName}`),
        axios.get(`https://api.nationalize.io/?name=${cleanName}`)
    ]);

    const { gender, probability, count } = genderRes.data;
    const { age } = ageRes.data;
    const countries = countryRes.data.country;
    //EDGE CASES
        if(!gender || probability ||count === 0) {
            return res.status(502).json({
                status: "error",
                message: "No gender data found"
            });
        }

        if(age === null) {
            return res.status(502).json({
                status: "error",
                message: "No age data found"
            })
        }
        if(!countries || countries.length === 0) {
            return res.status(502).json({
                status: "error",
                message: "No country data found"
            })
        }
        
    //AGE GROUPING
    let age_group;
    if (age <= 12) age_group = "child";
    else if (age <= 19) age_group = "teenager";
    else if (age <= 59) age_group = "adult";
    else age_group = "senior";

    //BEST COUNTRY
    const bestCountry = countries.reduce((prev, curr) =>
    curr.probability > prev.probability ? curr : prev);
    
    const id = uuidv7();
    const created_at = new Date().toISOString();
    await pool.query(
        `INSERT INTO profiles 
        (id, name, gender, gender_probability, sample_size, age, age_group, country_id, country_probability, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
            id,
            cleanName,
            gender,
            probability,
            count,
            age,
            age_group,
            bestCountry.country_id,
            bestCountry.probability,
            created_at
        ]
    );
    res.json({
        status : "success",
        data: {
            id,
            name: cleanName,
            gender,
            gender_probability: probability,
            sample_size: count,
            age,
            age_group,
            country_id: bestCountry.country_id,
            country_probability: bestCountry.probability,
            created_at

        }
    });
    }catch (error) {
        res.status(500).json({
            status: "error",
            message: "error fetching data from external APIs"
        });
    }

});

module.exports = router;







