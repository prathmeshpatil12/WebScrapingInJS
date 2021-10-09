// npm install minimist 
// npm install axios 
// npm install jsdom 
// npm install excel4node 
// npm install pdf-lib


// node WebScrapingCricInfo.js --url="https://www.espncricinfo.com/series/icc-cricket-world-cup-2019-1144415/match-results" --htmlFile="download.html" --dest="World Cup"

let minimist = require('minimist');
let fs = require('fs');
let axios = require('axios');
let jsdom = require('jsdom');
let excel = require('excel4node');
let path = require('path');
let pdf = require('pdf-lib');

let args = minimist(process.argv);

let dwnldPromise = axios.get(args.url);

dwnldPromise.then(function(response) {
    let html = response.data;
    fs.writeFileSync(args.htmlFile, html, 'utf-8');
    let dom = new jsdom.JSDOM(html);
    let document = dom.window.document;
    let matchBlocks = document.querySelectorAll("div.match-score-block");
    let matches = []

    for(let i=0; i<matchBlocks.length; i++) {
        let match = {
        };

        let NamePs = matchBlocks[i].querySelectorAll("p.name");
        match.t1Name = NamePs[0].textContent;
        match.t2Name = NamePs[1].textContent;
        // console.log(t1Name + " vs " + t2Name);

        let MatchScoreSpans = matchBlocks[i].querySelectorAll("span.score");
        // console.log(MatchScoreSpans.length);
        match.t1Score = "";
        match.t2Score = "";
        if(MatchScoreSpans.length==2) {
            match.t1Score = MatchScoreSpans[0].textContent;
            match.t2Score = MatchScoreSpans[1].textContent;
        } else if(MatchScoreSpans.length==1) {
            match.t1Score = MatchScoreSpans[0].textContent;
            match.t2Score = "";
        } else {
            match.t1Score = "";
            match.t2Score = "";
        }
        
        let statuses = matchBlocks[i].querySelectorAll("div.status-text > span");
        
        match.status = statuses[0].textContent;
        matches.push(match);
    }

    // console.log(matches);
    let matchesJSON = JSON.stringify(matches);
    // fs.writeFileSync("matches.json", matchesJSON, "utf-8");

    let knockoutMatches = []
    for(let i=0; i<3; i++) {
        knockoutMatches.push(matches[0]);
        matches.splice(0, 1);
    }
    // console.log(matches);
    // console.log(knockoutMatches);
    
    let teams = [] // Array which stores name of teams
    for(let i=0; i<matches.length; i++) {
        putTeamInTeamsArray(teams, matches[i]);
    }

    for(let i=0; i<matches.length; i++) {
        putMatchInAppropriateTeam(teams, matches[i]);
    }

    //console.log(teams);
    let teamsJSON = JSON.stringify(teams);
    // fs.writeFileSync("teams.json", teamsJSON, "utf-8");


    // Writing data to excel 

    // Making workbook
    let wb = new excel.Workbook();

    // Adding styling to cell
    let hstyle = wb.createStyle({
        font: {
            bold: true, 
            underline: true
        },
        fill: {
            type:'pattern',
            patternType: 'solid',
            fgColor: '#79bffc'
        },
        border: {
            left: {
                style: 'double', 
                color: 'black' 
            },
            right: {
                style: 'double', 
                color: 'black' 
            },
            top: {
                style: 'double', 
                color: 'black' 
            },
            bottom: {
                style: 'double', 
                color: 'black' 
            },
            outline:true
        }
    })

    // Making Sheets 
    for(let i=0; i<teams.length; i++) {
        let sheet = wb.addWorksheet(teams[i].name);
        sheet.column(1).setWidth(13);
        sheet.column(2).setWidth(17);
        sheet.column(3).setWidth(17);
        sheet.column(4).setWidth(50);
        
        sheet.cell(1, 1).string("OPPONENT").style(hstyle);
        sheet.cell(1, 2).string("MY SCORE").style(hstyle);
        sheet.cell(1, 3).string("OPPONENT SCORE").style(hstyle);
        sheet.cell(1, 4).string("RESULT").style(hstyle);

        for(let j=0; j<teams[i].matches.length; j++) {
            sheet.cell(j+2, 1).string(teams[i].matches[j].opponent);
            sheet.cell(j+2, 2).string(teams[i].matches[j].myScore);
            sheet.cell(j+2, 3).string(teams[i].matches[j].opponentScore);
            sheet.cell(j+2, 4).string(teams[i].matches[j].result);
        }
    }

    wb.write("Teams.csv");

    // Making Folders
    if(!fs.existsSync(args.dest)) {
        fs.mkdirSync(args.dest);
    }

    for(let i=0; i<teams.length; i++) {
        let FolderName = path.join(args.dest, teams[i].name);
        if(!fs.existsSync(FolderName)) {
            fs.mkdirSync(FolderName);
        }
        for(let j=0; j<teams[i].matches.length; j++) {
            let matchFileName = path.join(FolderName, teams[i].matches[j].opponent + ".pdf");
            createScoreCard(teams[i].name, teams[i].matches[j], matchFileName);
        }
        for(let i=0; i<knockoutMatches.length; i++) {
            let FolderName = path.join(args.dest, knockoutMatches[i].t1Name);
            if(!fs.existsSync(FolderName)) {
                fs.mkdirSync(FolderName);
            }
            let matchFileName = "";
            if(i==0) {
                matchFileName = path.join(FolderName, "Final.pdf");
            } else {
                matchFileName = path.join(FolderName, "Semifinal.pdf");
            }
            
            let knockoutMatch = {
                opponent: knockoutMatches[i].t2Name,
                myScore: knockoutMatches[i].t1Score,
                opponentScore: knockoutMatches[i].t2Score,
                result: knockoutMatches[i].status
            }
            createScoreCard(knockoutMatches[i].t1Name, knockoutMatch, matchFileName);

            FolderName = path.join(args.dest, knockoutMatches[i].t2Name);
            if(!fs.existsSync(FolderName)) {
                fs.mkdirSync(FolderName);
            }
            if(i==0) {
                matchFileName = path.join(FolderName, "Final.pdf");
            } else {
                matchFileName = path.join(FolderName, "Semifinal.pdf");
            }
            knockoutMatch = {
                opponent: knockoutMatches[i].t2Name,
                myScore: knockoutMatches[i].t1Score,
                opponentScore: knockoutMatches[i].t2Score,
                result: knockoutMatches[i].status
            }
            createScoreCard(knockoutMatches[i].t1Name, knockoutMatch, matchFileName);
        }
    }
    

}).catch(function(err) {
    console.log(err);
})
// Main function over

function putTeamInTeamsArray(teams, match) {
    let t1dx = -1;
    for(let i=0; i<teams.length; i++) {
        if(teams[i].name==match.t1Name) {
            t1dx = i;
            break;
        }
    }

    if(t1dx==-1) {
        teams.push({
            name: match.t1Name,
            matches: []
        });
    }

    let t2dx = -1;
    for(let i=0; i<teams.length; i++) {
        if(teams[i].name == match.t2Name) {
            t2dx = i;
            break;
        }
    }

    if(t2dx==-1) {
        teams.push({
            name: match.t2Name,
            matches: []
        });
    }
}

function putMatchInAppropriateTeam(teams, match) {
    let t1idx = -1;
    for(let i=0; i<teams.length; i++) {
        if(teams[i].name==match.t1Name) {
            t1idx=i;
            break;
        }
    }

    let team1 = teams[t1idx];
    team1.matches.push({
        opponent: match.t2Name,
        myScore: match.t1Score,
        opponentScore: match.t2Score,
        result: match.status
    });

    let t2idx = -1;
    for(let i=0; i<teams.length; i++) {
        if(teams[i].name==match.t2Name) {
            t2idx = i;
            break;
        }
    }

    let team2 = teams[t2idx];
    team2.matches.push({
        opponent: match.t1Name,
        myScore: match.t2Score,
        opponentScore: match.t1Score,
        result: match.status
    });

}

function createScoreCard(teamName, match, matchFileName) {
    let t1 = teamName;
    let t2 = match.opponent;
    let t3 = match.myScore;
    let t4 = match.opponentScore;
    let result = match.result;

    let originalBytes = fs.readFileSync("Template.pdf");

    let promiseToLoadDoc = pdf.PDFDocument.load(originalBytes);

    promiseToLoadDoc.then(function(pdfDoc) {
        let page = pdfDoc.getPage(0);
        page.drawText(t1, {
            x:70,
            y:390,
            size:18
        });

        page.drawText(t2, {
            x:315,
            y:390,
            size:18
        });

        page.drawText(t3, {
            x:205,
            y:390,
            size:18
        });

        page.drawText(t4, {
            x:435,
            y:390,
            size:18
        });

        page.drawText(result, {
            x:170,
            y:245,
            size:20
        });

        let promiseToSave = pdfDoc.save();
        promiseToSave.then(function (changedBytes) {
            fs.writeFileSync(matchFileName, changedBytes);
        });
    })
}