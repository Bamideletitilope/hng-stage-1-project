
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
    return res.status(200).json({
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
        if(!gender ||count === 0) {
            return res.status(422).json({
                status: "error",
                message: "No gender data found"
            });
        }

        if(age === null) {
            return res.status(422).json({
                status: "error",
                message: "No age data found"
            })
        }
        if(!countries || countries.length === 0) {
            return res.status(422).json({
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
    const bestCountry = countries?.reduce((prev, curr) =>
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
    return res.status(201).json({
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
        console.error(error);

       return res.status(500).json({
            status: "error",
            message: "Internal server error"
        });
    }

});

//GET ALL PROFILE
router.get('/profiles', async (req, res) => {
    try {
        const { gender, age_group, country_id } = req.query;

        let query = "SELECT * FROM profiles WHERE 1=1";
        const values = [];
        let count = 1;

        if (gender) {
            query += ` AND gender = $${count++}`;
            values.push(gender.toLowerCase());
        }

        if (age_group) {
            query += ` AND age_group = $${count++}`;
            values.push(age_group.toLowerCase());
        }

        if (country_id) {
            query += ` AND country_id = $${count++}`;
            values.push(country_id.toUpperCase());
        }

        const result = await pool.query(query, values);

        return res.status(200).json({
            status: "success",
            data: result.rows
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({
            status: "error",
            message: "Failed to fetch profiles"
        });
    }
});

//GET PROFILE BY ID
router.get('/profiles/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const result = await pool.query(
            "SELECT * FROM profiles WHERE id = $1",
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                status: "error",
                message: "Profile not found"
            });
        }

        return res.json({
            status: "success",
            data: result.rows[0]
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({
            status: "error",
            message: "Error fetching profile"
        });
    }
});

//DELETE PROFILE
router.delete('/profiles/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const result = await pool.query(
            "DELETE FROM profiles WHERE id = $1 RETURNING *",
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                status: "error",
                message: "Profile not found"
            });
        }

        return res.json({
            status: "success",
            message: "Profile deleted"
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({
            status: "error",
            message: "Error deleting profile"
        });
    }
});

module.exports = router;







