const express = require('express')
const path = require('path')

const {open} = require('sqlite')
const sqlite3 = require('sqlite3')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')

const app = express()
app.use(express.json())

const dbPath = path.join(__dirname, 'covid19IndiaPortal.db')
let db = null

const initializeDbServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    })
    app.listen(3000, () => {
      console.log('Server is Running at http://localhost:3000')
    })
  } catch (e) {
    console.log(`DB Error: ${e.message}`)
    process.exit(1)
  }
}
initializeDbServer()

const authenticateToken = (request, response, next) => {
  let jwtToken
  const authHeader = request.headers['authorization']

  if (authHeader !== undefined) {
    jwtToken = authHeader.split(' ')[1]
  }

  if (jwtToken === undefined) {
    response.status(401)
    response.send('Invalid JWT Token')
  } else {
    jwt.verify(jwtToken, 'SECRET_TOKEN', async (error, payload) => {
      if (error) {
        response.status(401)
        response.send('Invalid JWT Token')
      } else {
        request.username = payload.username
        next()
      }
    })
  }
}

// USER LOGIN API 1
app.post('/login/', async (request, response) => {
  const {username, password} = request.body
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`
  const dbUser = await db.get(selectUserQuery)

  if (dbUser === undefined) {
    response.status(400)
    response.send('Invalid user')
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password)
    if (isPasswordMatched === true) {
      const payload = {
        username: username,
      }
      const jwtToken = jwt.sign(payload, 'SECRET_TOKEN')
      response.send({jwtToken})
    } else {
      response.status(400)
      response.send('Invalid password')
    }
  }
})

//GET STATES API 2
app.get('/states/', authenticateToken, async (request, response) => {
  const convertDbObjectToResponseObject = dbObject => {
    return {
      stateId: dbObject.state_id,
      stateName: dbObject.state_name,
      population: dbObject.population,
    }
  }
  const statesDataQuery = `
  SELECT *
  FROM state
  ORDER BY state_id;`
  const statesArray = await db.all(statesDataQuery)
  response.send(
    statesArray.map(eachState => convertDbObjectToResponseObject(eachState)),
  )
})

//GET STATE BY ID API 3
app.get('/states/:stateId/', authenticateToken, async (request, response) => {
  const convertDbObjectToResponseObject = dbObject => {
    return {
      stateId: dbObject.state_id,
      stateName: dbObject.state_name,
      population: dbObject.population,
    }
  }
  const {stateId} = request.params
  const stateDataQuery = `
  SELECT *
  FROM state
  WHERE state_id = ${stateId};`
  const stateData = await db.get(stateDataQuery)
  response.send(convertDbObjectToResponseObject(stateData))
})

//ADD DISTRICT API 4
app.post('/districts/', authenticateToken, async (request, response) => {
  const districtDetails = request.body
  const {districtName, stateId, cases, cured, active, deaths} = districtDetails
  const districtDataQuery = `
  INSERT INTO
    district(district_name, state_id, cases, cured, active, deaths)
  VALUES
    ('${districtName}', '${stateId}', '${cases}', '${cured}', '${active}', ${deaths});`
  const dbResponse = await db.run(districtDataQuery)
  const districtId = dbResponse.lastID
  response.send('District Successfully Added')
})

//GET DISTRICT ID API 5
app.get(
  '/districts/:districtId/',
  authenticateToken,
  async (request, response) => {
    const convertDbObjectToResponseObject = dbObject => {
      return {
        districtId: dbObject.district_id,
        districtName: dbObject.district_name,
        stateId: dbObject.state_id,
        cases: dbObject.cases,
        cured: dbObject.cured,
        active: dbObject.active,
        deaths: dbObject.deaths,
      }
    }
    const {districtId} = request.params
    const districtDataQuery = `
  SELECT *
  FROM district
  WHERE district_id = ${districtId};`
    const districtData = await db.get(districtDataQuery)
    response.send(convertDbObjectToResponseObject(districtData))
  },
)

//DELETE DISTRICT API 6
app.delete(
  '/districts/:districtId/',
  authenticateToken,
  async (request, response) => {
    const {districtId} = request.params
    const deleteDistrictData = `
  DELETE FROM
    district
  WHERE district_id = ${districtId};`
    await db.run(deleteDistrictData)
    response.send('District Removed')
  },
)

//UPDATE THE DISTRICT DATA API 7
app.put(
  '/districts/:districtId/',
  authenticateToken,
  async (request, response) => {
    const {districtId} = request.params
    const districtUpdateDetails = request.body
    const {districtName, stateId, cases, cured, active, deaths} =
      districtUpdateDetails
    const districtUpdateDetailsQuery = `
  UPDATE district
  SET
    district_name = '${districtName}',
    state_id = '${stateId}',
    cases = '${cases}',
    cured = '${cured}',
    active = '${active}',
    deaths = '${deaths}'
  WHERE district_id = ${districtId};`
    await db.run(districtUpdateDetailsQuery)
    response.send('District Details Updated')
  },
)

//GET STATS OF COVID API 8
app.get(
  '/states/:stateId/stats/',
  authenticateToken,
  async (request, response) => {
    const {stateId} = request.params
    const getTheStatsOfCovid = `
  SELECT
    sum(cases) as totalCases,
    sum(cured) as totalCured,
    sum(active) as totalActive,
    sum(deaths) as totalDeaths
  FROM district
  WHERE state_id = ${stateId};`
    const statsReport = await db.get(getTheStatsOfCovid)
    response.send(statsReport)
  },
)

module.exports = app
