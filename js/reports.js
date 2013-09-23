// --------------------------------------------------------------------------------------------------------
//    GLOBAL VARS
// ====================
// global flag to display report for devs

var devMode = 0;

var apiKey = "b40e8bdc821f3a452466cb703622c5f20526dcab";
var urlProjects = "https://devprojects.uk2group.com/projects.json?limit=100";
var urlVersions = "https://devprojects.uk2group.com/projects/:project_id/versions.json";
var urlIssues = "https://devprojects.uk2group.com/issues.json?include=journals&project_id=:project_id&fixed_version_id=:version_id&limit=200&status_id=*";
var urlIssueStatuses = "https://devprojects.uk2group.com/issue_statuses.json";
var urlIssueComments = "https://devprojects.uk2group.com/issues/:issue_id.json?include=journals";
var urlTrackers = "https://devprojects.uk2group.com/trackers.json";


var allIssuesArray;
var allIssueStatuses;
var allTrackers;
var allIssuesCommentsArray;

var commentsMax = 200;

var pieDataSet1 = [];
var pieDataSet2 = [];

var barData = [4, 8, 15, 16, 23, 42];

var barDemo;

var username = "";
var password = "";
var basicAuthCredString = '';

var issuesCollectionCache = {};
var barGraphData = {};
var burnDownData = [];

var fadeInDelay = 100;
var fadeOutDelay = 100;

var mode;

var prevProjectName = ''; // used to check whether project has changed - reload issues

// --------------------------------------------------------------------------------------------------------
//    UTIL methods
// ====================

$.urlParam = function (sParam) {
    var sPageURL = window.location.search.substring(1);
    var sURLVariables = sPageURL.split('&');
    for (var i = 0; i < sURLVariables.length; i++) {
        var sParameterName = sURLVariables[i].split('=');
        if (sParameterName[0] == sParam) {
            return sParameterName[1];
        }
    }
}

// Array Remove - By John Resig (MIT Licensed)
Array.prototype.remove = function (from, to) {
    var rest = this.slice((to || from) + 1 || this.length);
    this.length = from < 0 ? this.length + from : from;
    return this.push.apply(this, rest);
};

// --------------------------------------------------------------------------------------------------------
//    FETCH methods
// ====================


function fetchProjects(successCallback) {
    $.ajax({
        type: "GET",
        dataType: 'json',
        url: urlProjects,
        beforeSend: function (xhr) {
            xhr.setRequestHeader("Authorization", basicAuthCredString);
        },
        success: function (data, textStatus, jqXHR) {
            if (_.isFunction(successCallback)) {
                successCallback(data);
            }
        },
        error: function (data) {
            console.log("fetchProjects: error");
            console.log(data);
        }
    });
}

function fetchVersions(projectId, successCallback) {
    var url = urlVersions.replace(':project_id', projectId);
    
    $.ajax({
        type: "GET",
        dataType: 'json',
        url: url,
        beforeSend: function (xhr) {
            xhr.setRequestHeader("Authorization", basicAuthCredString);
        },
        success: function (data, textStatus, jqXHR) {
            if (_.isFunction(successCallback)) {
                successCallback(projectId, data);
            }
        },
        error: function (data) {
            if (data.status == "403") {
                $("#versions-nav")
                    .html('&nbsp;');
                $("#error-section > span")
                    .html('you do not have access to <b>' + $("#projects option:selected")
                    .html() + '</b>');
                $(".report-section")
                    .fadeOut(fadeOutDelay, function () {
                    $("#error-section")
                        .stop()
                        .fadeIn(fadeInDelay);
                });
            }
        }
    });
}

function fetchIssues(projectId, versionId) {
    versionId = typeof versionId !== 'undefined' ? versionId : "1";

    // if cached - return that 
    if (issuesCollectionCache[projectId + '_' + versionId] !== undefined) {
        allIssuesArray = issuesCollectionCache[projectId + '_' + versionId];
        renderIssues();
    } else {
        // fetch issues for given project + version id
        var url = urlIssues.replace(':project_id', projectId)
            .replace(':version_id', versionId);

        $(".report-section")
            .fadeOut(fadeOutDelay);

        $.ajax({
            type: "GET",
            dataType: 'json',
            url: url,
            beforeSend: function (xhr) {
                xhr.setRequestHeader("Authorization", basicAuthCredString);
            },
            success: function (data, textStatus, jqXHR) {
                allIssuesArray = data.issues;

                // cache issues for this version
                issuesCollectionCache[projectId + '_' + versionId] = data.issues;

                renderIssues();
            },
            error: function (data) {
                console.log("fetchIssues: error");
                console.log(data);
            }
        });
    }
}

function fetchIssueComments(){
    allIssuesCommentsArray = [];

    // if cached - load those
    var versionId = $.bbq.getState( 'vid' ) || '';
    var projectId = $.bbq.getState( 'pid' ) || '';
    var mode = $.bbq.getState( 'pid' ) || '';

    if (issuesCollectionCache[projectId + "_" + versionId + "_" + mode] !== undefined){
        allIssuesCommentsArray = issuesCollectionCache[projectId + "_" + versionId + "_" + mode];
        renderIssuesComments();
    }
    else{
        $("#planning-issues-section .issues tbody").html('');
        commentsMax = allIssuesArray.length;
        // reset progress bar
        $("#fetching-issues .bar").width(0);
        $("#fetching-issues").fadeIn(fadeInDelay);

        var fns = [];
        var progressIncrement = $("#wrapper").width() / commentsMax;
        var progressTotal = 0;

        $.each(allIssuesArray, function (i, item) {
            if ( i < commentsMax){
                fns.push(
                    $.ajax({
                        type: "GET",
                        dataType: 'json',
                        url: urlIssueComments.replace(':issue_id', item.id),
                        beforeSend: function (xhr) {
                            xhr.setRequestHeader("Authorization", basicAuthCredString);
                        },
                        success: function (data, textStatus, jqXHR) {
                            $("#fetching-issues .bar").width( (allIssuesCommentsArray.length + 1) * progressIncrement );
                            allIssuesCommentsArray.push(data.issue);
                            renderPlanningIssue(data.issue);
                        },
                        error: function (data) {
                            console.log(data);
                            if (data.status == "401") {
                                $("#error-msg").show().html('details incorrect');
                            }
                        }
                    })
                );
            }
        });
            
        $.when.apply($, fns).done( function(){
            // cache results for next time 
            issuesCollectionCache[projectId + "_" + versionId + "_" + mode] = allIssuesCommentsArray;
            renderIssuesComments();
        });

    }
}

function renderIssuesComments(){
    
    $("#fetching-issues").fadeOut(fadeOutDelay * 3);
    
    $("#planning-issues-section").fadeIn(fadeInDelay);

    // add table sort
    $("#planning-issues-section .issues").tablesort();

    $("#planning-issues-section .issues").bind("sortStart",function() { 
        // hide comments rows;
        $("#planning-issues-section .issues .desc").remove();
    });

    $('#planning-issues-section .issues th.issue-id').data('sortBy', function (th, td, sorter) {
        return parseInt(td.text(), 10);
    });

    $('#planning-issues-section .issues th.done-ratio-bar')
        .data('sortBy', function (th, td, sorter) {
        return parseInt($(td).children('span.done-ratio-bar').css('width'), 10);
    });

    // default sort by id
    var tablesort = $('#planning-issues-section .issues ').data('tablesort');
    tablesort.sort($('.issue-id'), 'desc');

    $("#planning-issues-section .issues tbody tr").click(function(){
        if ($(this).next('.desc').length == 0){
            expandIssueRow($(this));
        } else {
            $(this).removeClass('open');
            $(this).next('.desc').remove();
            $(this).next('.comments').remove();
        }   
    });
}

function expandIssueRow($issueRow){
    var issue = allIssuesCommentsArray[$issueRow.attr("data-planning-issue-index")];
    // create TEMPLATES for these;
    var commentsList = '<ul class="issue-comments">';
    var showComments = false;
    $.each(issue.journals,function(index, journal){
        // ignore notes that have no length, empty ones.
        if (journal.notes.length > 0){
            commentsList += '<li><span class="author">' + journal.user.name + '</span><div class="comment-body">' + journal.notes + '</div></li>';
            showComments = true;
        }
    });
    commentsList += "</ul>";

    if (showComments){
        $issueRow.after($('<tr class="comments"><td colspan="6">' + commentsList + '</td></tr>'));
    }

    $issueRow.after($('<tr class="desc"><td></td><td colspan="5">' + issue.description + '</td></tr>'));
    $issueRow.addClass('open');
}

function fetchTrackers() {

    $.ajax({
        type: "GET",
        dataType: 'json',
        url: urlTrackers,
        beforeSend: function (xhr) {
            xhr.setRequestHeader("Authorization", basicAuthCredString);
        },
        success: function (data, textStatus, jqXHR) {
            $("#login-section")
                .fadeOut(fadeOutDelay);
            allTrackers = data.trackers;
            fetchIssueStatuses();
        },
        error: function (data) {
            console.log(data);
            $('#username, #password, #loginform')
                .addClass('error');
            $('.error-alert')
                .show();
            $("#btn-login")
                .val($("#btn-login")
                .data('original-text'));
        }
    });
}

function fetchIssueStatuses() {
    $.ajax({
        type: "GET",
        dataType: 'json',
        url: urlIssueStatuses,
        beforeSend: function (xhr) {
            xhr.setRequestHeader("Authorization", basicAuthCredString);
        },
        success: function (data, textStatus, jqXHR) {
            allIssueStatuses = data.issue_statuses;
            $("header").fadeIn(fadeInDelay);
            fetchProjects(_.bind(renderProjects, this));
        },
        error: function (data) {
            console.log(data);
            if (data.status == "401") {
                $("#error-msg").show().html('details incorrect');
            }
        }
    });
}

// --------------------------------------------------------------------------------------------------------
//    RENDER methods
// ====================


function renderProjects(projectsArray) {
    var projectsOptions = '';
    $.each(projectsArray.projects, function (i, item) {
        if (!item.parent) {
            projectsOptions += '<option value="' 
            + item.identifier 
            + '" data-projectid="' 
            + item.id + '">' 
            + item.name 
            + '</option>';
        }
    });
    $("#projects").append(projectsOptions);
    $("#projects").change(function (evt) {
        // remove first option place holder
        $(".select-a-project").remove();
        var projectId = $("#projects option:selected").attr('data-projectid');

        var state = {},
          url = $(this).attr("data-versionid");
        
        // Set the state!
        if (!$.bbq.getState( 'mode' )) 
        {
            state[ "mode" ] = 'r'
        }
        state[ "pid" ] = $("#projects option:selected").val();

        $.bbq.pushState( state );
    });

    // if vid is in the parameters - this is a returning user to the url
    var versionId = $.bbq.getState( 'vid' ) || '';
    if (versionId !== ''){
        renderProjectIssuesFromUrl();
    }

    $("#project-version-section")
        .fadeIn(fadeInDelay);
}

function renderVersions(projectId, versionsArray) {

    $("#versions-nav").html('');

    $.each(versionsArray.versions, function (i, item) {
        $("#versions-nav").append('<a href="#" data-versionstatus="' + item.status + '" data-created-on="' + item.created_on + '" data-due-date="' + item.due_date + '" data-versionid="' + item.id + '" data-projectid="' + projectId + '">' + item.name + '</a>');
    });
    $("#versions-nav a:first-child").addClass('selected');
    $('#version-status').show().html($("#versions-nav a:first-child").attr('data-versionstatus'));
    $('#version-status').fadeIn(fadeInDelay);
    $("#versions-nav").fadeIn(fadeInDelay);

    var versionId = $.bbq.getState( 'vid' ) || '';
    var versionLink = $("#versions-nav a[data-versionid=" + versionId + "]");

    if (versionLink.length == 0) { // if not found - highlight the first one
        versionLink = $("#versions-nav a").first();
        versionId = versionLink.attr('data-versionid');
    }
    versionLink.siblings('.selected').removeClass('selected');
    versionLink.addClass('selected');
    
    fetchIssues(projectId,versionId); // fetch issues for the first version in the project

    $("#versions-nav a").click(function (evt) {
        evt.preventDefault();

        var state = {},
          url = $(this).attr("data-versionid");
        
        // Set the state!
        state[ "pid" ] = $("#projects option:selected").val(),
        state[ "vid" ] = url;

        $.bbq.pushState( state );
        
        return false;
    });
}

function renderIssues() {

    if (allIssuesArray.length === 0) {

        $("#no-issues-section .project-name").html($("#projects option:selected").html());
        $("#no-issues-section .version-name").html($("#versions-nav a.selected").html());

        // report section didnt fade away because there was no fetching ( cached )
        if ($("#pie-graph-section").css('opacity', 1)) {
          $(".report-section").hide();
        }
        $("#no-issues-section").stop().fadeIn(fadeInDelay);

    } else {

        mode = $.bbq.getState( 'mode' ) || '';

        if (mode == 'r'){
            $("#mode").html("Report");
            $("#reports-link").hide();
            $("#planning-link").show();
            renderReport();
        }else if(mode == 'p'){
            $("#mode").html("Planning");
            $("#planning-link").hide();
            $("#reports-link").show();
            fetchIssueComments();
        }
    }
}

function renderPlanningIssue(issue){
    $(".planning-section").fadeIn(fadeInDelay);

    var issueLink = '<a target="_blank" href="/issues/' + issue.id + '">' + issue.id + '</a>';
    var issueRow = '<tr data-planning-issue-index="' + (allIssuesCommentsArray.length - 1)
                 + '"><td>' + issueLink
                 + '</td><td>' + issue.subject
                 + '</td><td>' + issue.custom_fields[1].value
                 + '</td><td>' + issue.tracker.name
                 + '</td><td>' + issue.status.name + '</td><td>' 
                 + ((issue.assigned_to === undefined) ? '' : issue.assigned_to.name) + '</td>'
                 + '<td class="done-ratio-bar">&nbsp;<span class="done-ratio-bar" style="width:' + issue.done_ratio + '%;"></span></td></tr>';

    $("#planning-issues-section .issues tbody").append(issueRow);
}

function renderReport(){
    $(".report-section").fadeIn(fadeInDelay);

    renderReportIssues();
    renderPieCharts();

    $("#no-issues-section")
        .hide();
    $("#pie-graph-section")
        .fadeIn(fadeInDelay);
    $("#issues-section")
        .fadeIn(fadeInDelay);
    drawBurnDownGraph();
}

function renderReportIssues() {
    $("#issues-section .issue-count").html(allIssuesArray.length);

    if (devMode) {
        $('<th id="th-dev">&nbsp;</th>').insertBefore("#issues-section .issues thead th:last-child");
    }

    var totalScrumPoints = 0,
        issuesRows = '';
    $.each(allIssuesArray, function (i, item) {
        var issueLink = '<a target="_blank" href="/issues/' + item.id + '">' + item.id + '</a>'
            scrumPoints = parseInt(item.custom_fields[1].value) || 0;

        totalScrumPoints += scrumPoints;
        issuesRows += '<tr><td>' + issueLink
                     + '</td><td>' + item.subject
                     + '</td><td>' + item.custom_fields[1].value
                     + '</td><td>' + item.tracker.name
                     + '</td><td>' + item.status.name + '</td>';
        if (devMode) {
            issuesRows += '<td>' + ((item.assigned_to === undefined) ? '' : item.assigned_to.name) + '</td>';
        }
        issuesRows += '<td class="done-ratio-bar">&nbsp;<span class="done-ratio-bar" style="width:' + item.done_ratio + '%;"></span></td></tr>';
    });

    $('#issues-section .issue-total-points').html(totalScrumPoints);

    $("#issues-section .issues tbody").html(issuesRows);
    $("#issues-section .issues").tablesort();

    $('#issues-section .issues th.issue-id').data('sortBy', function (th, td, sorter) {
        return parseInt(td.text(), 10);
    });
    $('#issues-section .issues th.done-ratio-bar')
        .data('sortBy', function (th, td, sorter) {
        return parseInt($(td).children('span.done-ratio-bar').css('width'), 10);
    });
    // default sort by id
    var tablesort = $('table').data('tablesort');
    tablesort.sort($('.issue-id'), 'desc');

}

function renderPieCharts() {
    // filter issues by status and add count to pieDataSet for each status
    $.each(allIssueStatuses, function (i, item) {
        var statusName = item.name;
        var issuesByStatus = _.filter(allIssuesArray, function (issue) {
          return issue.status.name == statusName;
        });

        pieDataSet1.push({
            "legendLabel": statusName,
            "magnitude": issuesByStatus.length
        });
    });

    // pie chart 2 data - get open issues
    var openIssues = _.filter(allIssuesArray, function (issue) {
        return issue.status.name != "closed";
    });
    $.each(allTrackers, function (i, item) {
        var trackerName = item.name;
        var openIssuesByTracker = _.filter(allIssuesArray, function (issue) {
            return issue.tracker.name == trackerName;
        });
        pieDataSet2.push({
            "legendLabel": trackerName,
            "magnitude": openIssuesByTracker.length
        });
    });

    //clear old pies
    $("svg").remove();
    $("a.legend_link").remove();

    drawPie("Pie1", pieDataSet1, "#issues-by-status .chart", "colorScale20", 10, 100, 5, 0);
    drawPie("Pie2", pieDataSet2, "#open-issues-by-tracker .chart", "colorScale20", 10, 100, 5, 0);
    pieDataSet1 = [];
    pieDataSet2 = [];

    // only show bar graph if in dev mode
    if (devMode) {
        barGraphData = {};
        // draw bar graph
        // loop through all issues and collate total dev points for developers
        $.each(allIssuesArray, function (i, item) {
            if (item.assigned_to !== undefined) {
                if (barGraphData[item.assigned_to.name] === undefined) {
                    barGraphData[item.assigned_to.name] = {
                        "developer": item.assigned_to.name,
                        "totalScrumPoints": 0
                    };
                }
                barGraphData[item.assigned_to.name].totalScrumPoints += parseInt(item.custom_fields[1].value, 10) || 0;
            }
        });
        barGraphData = _.toArray(barGraphData);
        redrawBarGraph();
        $("#points-per-dev-section")
            .fadeIn(fadeInDelay);
    }

}

// --------------------------------------------------------------------------------------------------------
//    GRAPHING methods
// ======================

function drawBurnDownGraph() {

    // Prepare data for Burn Down.
    burnDownData = [];
    var selectedVersionLink = $("#versions-nav a.selected");
    var versionCreatedOn = moment(selectedVersionLink.attr('data-created-on'));
    var versionDueDate = moment(selectedVersionLink.attr('data-due-date'));
    var fourWeeksBeforeDueDate = moment(selectedVersionLink.attr('data-due-date'));
    fourWeeksBeforeDueDate.subtract('weeks',4);

    versionTotalDays = versionDueDate.diff(fourWeeksBeforeDueDate, 'days');

    var currDate = fourWeeksBeforeDueDate;
    var totalVersionScrumPoints = 0;

    // calculate total scrum points of all issues for this version
    _.each(allIssuesArray, function (issue, index) {
        totalVersionScrumPoints += (!isNaN(parseFloat(issue.custom_fields[1].value))) ? parseFloat(issue.custom_fields[1].value) : 0.0;
    });

    var estScrumPointsPerDay = totalVersionScrumPoints / versionTotalDays;
    var actualScrumPointsRemaining = 0 ;
    // completed issues array 
    var completedIssuesArray = _.filter(allIssuesArray, function (issue) {
        if (issue.custom_fields[0].value !== undefined && 
          issue.custom_fields[0].value.length > 0 &&
          moment(issue.custom_fields[0].value).diff(fourWeeksBeforeDueDate, 'days') >= 0 ){
          actualScrumPointsRemaining += (!isNaN(parseFloat(issue.custom_fields[1].value))) ? parseFloat(issue.custom_fields[1].value) : 0.0;
          return true;
        }
        return false;
    });

    // POSSIBLE ALTERNATE ALGORITHM
    // sort all issues ascending by completed date and simply look at the first one rather than loop through everytime
    for (i = 0; i < versionTotalDays; i++) {
        // find issues that were completed today and decrement scrum points - then delete issue
        _.each(completedIssuesArray, function (issue, index) {
            if (issue.custom_fields[0].value !== undefined && issue.custom_fields[0].value.length > 0 && currDate.diff(moment(issue.custom_fields[0].value), 'days') == 0) {
                actualScrumPointsRemaining -= (!isNaN(parseFloat(issue.custom_fields[1].value))) ? parseFloat(issue.custom_fields[1].value) : 0.0;
                completedIssuesArray.remove(index);
            }
        });
        currDate.add("days", 1);

        burnDownData.push({
            "day_value": i,
            "estimated_points_remaining": totalVersionScrumPoints - (i * estScrumPointsPerDay),
            "actual_points_remaining": actualScrumPointsRemaining
        });
    }

    /* Read CSV file: first row =>  year,top1,top5  */
    var maxval = 0,
        sampsize = 0;
    var label_array = new Array(),
        val_array1 = new Array();

    sampsize = burnDownData.length;

    for (var i = 0; i < sampsize; i++) {
        label_array[i] = parseInt(burnDownData[i].day_value);
        val_array1[i] = {
            x: label_array[i],
            y: parseFloat(burnDownData[i].estimated_points_remaining),
            z: parseFloat(burnDownData[i].actual_points_remaining)
        };
        maxval = Math.max(maxval, parseFloat(burnDownData[i].estimated_points_remaining), parseFloat(burnDownData[i].actual_points_remaining));
    }

    maxval = (1 + Math.floor(maxval / 10)) * 10;

    var w = 500,
        h = 300,
        p = 45,
        x = d3.scale.linear()
            .domain([label_array[0], label_array[sampsize - 1] + 2])
            .range([0, w]),
        y = d3.scale.linear()
            .domain([0, maxval + 2])
            .range([h, 0]);

    var vis = d3.select("#paired-line-chart")
        .data([val_array1])
        .append("svg:svg")
        .attr("width", w + p * 2)
        .attr("height", h + p * 2)
        .append("svg:g")
        .attr("transform", "translate(" + p + ", " + p + ")");

    var rules = vis.selectAll("g.rule")
        .data(x.ticks(15))
        .enter()
        .append("svg:g")
        .attr("class", "rule");

    // Draw grid lines
    rules.append("svg:line")
        .attr("x1", x)
        .attr("x2", x)
        .attr("y1", 0)
        .attr("stroke", "#f5f5f5")
        .attr("y2", h - 1);

    rules.append("svg:line")
        .attr("class", function (d) {
        return d ? null : "axis";
    })
        .data(y.ticks(10))
        .attr("y1", y)
        .attr("y2", y)
        .attr("x1", 0)
        .attr("stroke", "#f5f5f5")
        .attr("x2", w - 10);

    // Place axis tick labels
    rules.append("svg:text")
        .attr("x", x)
        .attr("y", h + 15)
        .attr("dy", ".71em")
        .attr("text-anchor", "middle")
        .attr("fill", "#000")
        .attr("style", "font-size: 13; font-family: Helvetica, Arial, sans-serif; ")
        .text(x.tickFormat(10))
        .text(String);

    rules.append("svg:text")
        .data(y.ticks(12))
        .attr("y", y)
        .attr("x", - 10)
        .attr("dy", ".35em")
        .attr("fill", "#000")
        .attr("style", "font-size: 13; font-family: Helvetica, Arial, sans-serif; ")
        .attr("text-anchor", "end")
        .text(y.tickFormat(5));

    // Place axis labels
    vis.append("text")
        .attr("class", "x label")
        .attr("text-anchor", "end")
        .attr("x", w + 10)
        .attr("y", h + 30 + 10)
        .attr("fill", "#ccc")
        .attr("style", "font-size: 12; font-family: Helvetica, Arial, sans-serif; ")
        .text("days");

    vis.append("text")
        .attr("class", "y label")
        .attr("text-anchor", "end")
        .attr("y", -45)
        .attr("x", 0)
        .attr("dy", ".75em")
        .attr("fill", "#ccc")
        .attr("transform", "rotate(-90)")
        .attr("style", "font-size: 12; font-family: Helvetica, Arial, sans-serif; ")
        .text("scrum points");
        
    // Series I
    vis.append("svg:path")
        .attr("class", "line")
        .attr("fill", "none")
        .attr("stroke", "#000")
        .attr("stroke-width", 2)
        .attr("d", d3.svg.line()
        .x(function (d) {
        return x(d.x);
    })
        .y(function (d) {
        return y(d.y);
    }));

    // Series II
    vis.append("svg:path")
        .attr("class", "line")
        .attr("fill", "none")
        .attr("stroke", "orange")
        .attr("stroke-width", 2)
        .attr("d", d3.svg.line()
        .x(function (d) {
        return x(d.x);
    })
        .y(function (d) {
        return y(d.z);
    }));

    vis.select("circle.line")
        .data(val_array1)
        .enter()
        .append("svg:circle")
        .attr("class", "line")
        .attr("fill", "darkblue")
        .attr("cx", function (d) {
        return x(d.x);
    })
        .attr("cy", function (d) {
        return y(d.z);
    })
        .attr("r", 3);

    // -----------------------------
    // Add Title then Legend
    // -----------------------------
    vis.append("svg:rect")
        .attr("x", w / 2 )
        .attr("y", -20)
        .attr("fill", "#000")
        .attr("height", 2)
        .attr("width", 40);

    vis.append("svg:text")
        .attr("x", 50 + w / 2)
        .attr("fill", "#000")
        .attr("y", -15)
        .attr("style", "font-size: 12; font-family: Helvetica, Arial, sans-serif; ")
        .text("Estimated Scrum Points Remaining");

    vis.append("svg:rect")
        .attr("x", w / 2)
        .attr("y", 0)
        .attr("fill", "orange")
        .attr("height", 2)
        .attr("width", 40);

    vis.append("svg:text")
        .attr("x", 50 + w / 2)
        .attr("y", 5)
        .attr("fill", "#000")
        .attr("style", "font-size: 12; font-family: Helvetica, Arial, sans-serif; ")
        .text("Actual Scrum Points Remaining");
}

function drawBarGraph() {

    var data = barGraphData;
    var barWidth = 80;
    var width = (barWidth + 10) * data.length;
    var height = 200;

    var x = d3.scale.linear()
        .domain([0, data.length])
        .range([0, width]);
    var y = d3.scale.linear()
        .domain([0, d3.max(data, function (datum) {
        return datum.totalScrumPoints;
    })])
        .
    rangeRound([0, height]);

    // add the canvas to the DOM
    barDemo = d3.select("#bar-demo")
    .append("svg:svg")
    .attr("width", width)
    .attr("height", height);

    barDemo.selectAll("rect")
    .data(data)
    .enter()
    .append("svg:rect")
    .attr("x", function (datum, index) {
      return x(index);
    })
    .attr("y", function (datum) {
      return height - y(datum.totalScrumPoints);
    })
    .attr("height", function (datum) {
      return y(datum.totalScrumPoints);
    })
    .attr("width", barWidth)
    .attr("fill", "#2d578b");

    // add value text to each bar
    barDemo.selectAll("text")
      .data(data)
      .enter()
      .append("svg:text")
      .attr("x", function (datum, index) {
          return x(index) + barWidth;
      })
      .attr("y", function (datum) {
          return height - y(datum.totalScrumPoints);
      })
      .attr("dx", - barWidth / 2)
      .attr("dy", "1.2em")
      .attr("text-anchor", "middle")
      .text(function (datum) {
          return (datum.totalScrumPoints == 0) ? '' : datum.totalScrumPoints;
      })
      .attr("fill", "white");

    // add x axis labels under each bar
    barDemo.selectAll("text.yAxis")
      .data(data)
      .enter()
      .append("svg:text")
      .attr("x", function (datum, index) {
          return x(index) + barWidth;
      })
      .attr("y", height)
      .attr("dx", - barWidth / 2)
      .attr("text-anchor", "middle")
      .attr("style", "font-size: 11; font-family: Helvetica, sans-serif; ")
      .attr("fill", "#000")
      .text(function (datum) {
      return datum.developer.match(/[^ ]+ ./);
      })
      .attr("transform", "translate(0, 18)")
      .attr("class", "yAxis");
}

function redrawBarGraph() {

    if ($("#bar-demo").html().length == 0) {
        drawBarGraph();
    }

    var barWidth = 80;
    var width = (barWidth + 10) * barGraphData.length;
    var height = 200;

    var x = d3.scale.linear()
        .domain([0, barGraphData.length])
        .range([0, width]);
    var y = d3.scale.linear()
        .domain([0, d3.max(barGraphData, function (datum) {
        return datum.totalScrumPoints;
    })])
        .rangeRound([0, height]);
}



/*
    pieName => A unique drawing identifier that has no spaces, no "." and no "#" characters.
    dataSet => Input Data for the chart, itself.
    selectString => String that allows you to pass in
              a D3 select string.
    colors => String to set color scale.  Values can be...
              => "colorScale10"
              => "colorScale20"
              => "colorScale20b"
              => "colorScale20c"
    margin => Integer margin offset value.
    outerRadius => Integer outer radius value.
    innerRadius => Integer inner radius value.
    sortArcs => Controls sorting of Arcs by value.
                 0 = No Sort.  Maintain original order.
                 1 = Sort by arc value size.
*/
function drawPie(pieName, dataSet, selectString, colors, margin, outerRadius, innerRadius, sortArcs) {
    // Color Scale Handling...
    var colorScale = d3.scale.category20c();
    switch (colors) {
    case "colorScale10":
        colorScale = d3.scale.category10();
        break;
    case "colorScale20":
        colorScale = d3.scale.category20();
        break;
    case "colorScale20b":
        colorScale = d3.scale.category20b();
        break;
    case "colorScale20c":
        colorScale = d3.scale.category20c();
        break;
    default:
        colorScale = d3.scale.category20c();
    };

    var canvasWidth = 500;
    var pieWidthTotal = outerRadius * 2;;
    var pieCenterX = outerRadius + margin / 2;
    var pieCenterY = outerRadius + margin / 2;
    var legendBulletOffset = -50;
    var legendVerticalOffset = outerRadius - margin;
    var legendTextOffset = 20;
    var textVerticalSpace = 20;

    var canvasHeight = 0;
    var pieDrivenHeight = outerRadius * 2 + margin * 2;
    var legendTextDrivenHeight = (dataSet.length * textVerticalSpace) + margin * 2;
    // Autoadjust Canvas Height
    if (pieDrivenHeight >= legendTextDrivenHeight) {
        canvasHeight = pieDrivenHeight;
    } else {
        canvasHeight = legendTextDrivenHeight;
    }

    var x = d3.scale.linear()
        .domain([0, d3.max(dataSet, function (d) {
        return d.magnitude;
    })])
        .rangeRound([0, pieWidthTotal]);
    var y = d3.scale.linear()
        .domain([0, dataSet.length])
        .range([0, (dataSet.length * 20)]);


    var synchronizedMouseOver = function () {
        var arc = d3.select(this);
        var indexValue = arc.attr("index_value");

        var arcSelector = "." + "pie-" + pieName + "-arc-" + indexValue;
        var selectedArc = d3.selectAll(arcSelector);
        selectedArc.style("fill", "#000");

        var bulletSelector = "." + "pie-" + pieName + "-legendBullet-" + indexValue;
        var selectedLegendBullet = d3.selectAll(bulletSelector);
        selectedLegendBullet.style("fill", "#000");

        var textSelector = "." + "pie-" + pieName + "-legendText-" + indexValue;
        var selectedLegendText = d3.selectAll(textSelector);
        selectedLegendText.style("fill", "#FFA500");
        selectedLegendText.attr("style", "font-weight:bold;")
    };

    var synchronizedMouseOut = function () {
        var arc = d3.select(this);
        var indexValue = arc.attr("index_value");

        var arcSelector = "." + "pie-" + pieName + "-arc-" + indexValue;
        var selectedArc = d3.selectAll(arcSelector);
        var colorValue = selectedArc.attr("color_value");
        selectedArc.style("fill", colorValue);

        var bulletSelector = "." + "pie-" + pieName + "-legendBullet-" + indexValue;
        var selectedLegendBullet = d3.selectAll(bulletSelector);
        var colorValue = selectedLegendBullet.attr("color_value");
        selectedLegendBullet.style("fill", colorValue);

        var textSelector = "." + "pie-" + pieName + "-legendText-" + indexValue;
        var selectedLegendText = d3.selectAll(textSelector);
        selectedLegendText.style("fill", "#888");
        selectedLegendText.attr("style", "font-weight:normal;")
    };

    //  tween pie animation - currently disabled
    var tweenPie = function (b) {
        b.innerRadius = 0;
        var i = d3.interpolate({
            startAngle: 0,
            endAngle: 0
        }, b);
        return function (t) {
            return arc(i(t));
        };
    }

    // Create a drawing canvas...
    var canvas = d3.select(selectString)
        .append("svg:svg") //create the SVG element inside the <body>
    .data([dataSet]) //associate our data with the document
    .attr("width", canvasWidth) //set the width of the canvas
    .attr("height", canvasHeight) //set the height of the canvas
    .append("svg:g") //make a group to hold our pie chart
    .attr("transform", "translate(" + pieCenterX + "," + pieCenterY + ")") // Set center of pie

    // Define an arc generator. This will create <path> elements for using arc data.
    var arc = d3.svg.arc()
        .innerRadius(innerRadius) // Causes center of pie to be hollow
    .outerRadius(outerRadius);

    // Define a pie layout: the pie angle encodes the value of dataSet.
    // Since our data is in the form of a post-parsed CSV string, the
    // values are Strings which we coerce to Numbers.
    var pie = d3.layout.pie()
        .value(function (d) {
        return d.magnitude;
    })
        .sort(function (a, b) {
        if (sortArcs == 1) {
            return b.magnitude - a.magnitude;
        } else {
            return null;
        }
    });

    // Select all <g> elements with class slice (there aren't any yet)
    var arcs = canvas.selectAll("g.slice")
    // Associate the generated pie data (an array of arcs, each having startAngle,
    // endAngle and value properties) 
    .data(pie)
    // This will create <g> elements for every "extra" data element that should be associated
    // with a selection. The result is creating a <g> for every object in the data array
    // Create a group to hold each slice (we will have a <path> and a <text>      // element associated with each slice)
    .enter()
        .append("svg:a")
        .attr("xlink:href", function (d) {
        return d.data.link;
    })
        .append("svg:g")
        .attr("class", "slice") //allow us to style things in the slices (like text)
    // Set the color for each slice to be chosen from the color function defined above
    // This creates the actual SVG path using the associated data (pie) with the arc drawing function
    .style("stroke", "white")
        .attr("d", arc);

    arcs.append("svg:path")
    // Set the color for each slice to be chosen from the color function defined above
    // This creates the actual SVG path using the associated data (pie) with the arc drawing function
    .attr("fill", function (d, i) {
        return colorScale(i);
    })
        .attr("color_value", function (d, i) {
        return colorScale(i);
    }) // Bar fill color...
    .attr("index_value", function (d, i) {
        return "index-" + i;
    })
        .attr("class", function (d, i) {
        return "pie-" + pieName + "-arc-index-" + i;
    })
        .style("stroke", "white")
        .attr("d", arc)
        .on('mouseover', synchronizedMouseOver)
        .on("mouseout", synchronizedMouseOut)
        .transition()
        .ease("bounce")
        .duration(2000)
        .delay(function (d, i) {
        return i * 50;
    });
    // .attrTween("d", tweenPie);

    // Add a magnitude value to the larger arcs, translated to the arc centroid and rotated.
    arcs.filter(function (d) {
        return d.endAngle - d.startAngle > .2;
    })
        .append("svg:text")
        .attr("dy", ".35em")
        .attr("text-anchor", "middle")
    //.attr("transform", function(d) { return "translate(" + arc.centroid(d) + ")rotate(" + angle(d) + ")"; })
    .attr("transform", function (d) { //set the label's origin to the center of the arc
        //we have to make sure to set these before calling arc.centroid
        d.outerRadius = outerRadius; // Set Outer Coordinate
        d.innerRadius = innerRadius; // Set Inner Coordinate
        // the next line rotates the number in the pie slice
        // return "translate(" + arc.centroid(d) + ")rotate(" + angle(d) + ")";
        return "translate(" + arc.centroid(d) + ")";
    })
        .style("fill", "white")
        .style("font", "normal 12px Arial")
        .text(function (d) {
        return d.data.magnitude;
    });

    // Computes the angle of an arc, converting from radians to degrees.
    function angle(d) {
        var a = (d.startAngle + d.endAngle) * 90 / Math.PI - 90;
        return a > 90 ? a - 180 : a;
    }

    // Plot the bullet circles...
    canvas.selectAll("circle")
        .data(dataSet)
        .enter()
        .append("svg:circle") // Append circle elements
    .attr("cx", pieWidthTotal + legendBulletOffset)
        .attr("cy", function (d, i) {
        return i * textVerticalSpace - legendVerticalOffset;
    })
        .attr("stroke-width", ".5")
        .style("fill", function (d, i) {
        return colorScale(i);
    }) // Bullet fill color
    .attr("r", 5)
        .attr("color_value", function (d, i) {
        return colorScale(i);
    }) // Bar fill color...
    .attr("index_value", function (d, i) {
        return "index-" + i;
    })
        .attr("class", function (d, i) {
        return "pie-" + pieName + "-legendBullet-index-" + i;
    })
        .on('mouseover', synchronizedMouseOver)
        .on("mouseout", synchronizedMouseOut);

    // Create hyper linked text at right that acts as label key...
    canvas.selectAll("a.legend_link")
        .data(dataSet) // Instruct to bind dataSet to text elements
    .enter()
        .append("svg:a") // Append legend elements
    .attr("xlink:href", function (d) {
        return d.link;
    })
        .append("text")
        .attr("text-anchor", "center")
        .attr("x", pieWidthTotal + legendBulletOffset + legendTextOffset)
    //.attr("y", function(d, i) { return legendOffset + i*20 - 10; })
    //.attr("cy", function(d, i) {    return i*textVerticalSpace - legendVerticalOffset; } )
    .attr("y", function (d, i) {
        return i * textVerticalSpace - legendVerticalOffset;
    })
        .attr("dx", 0)
        .attr("dy", "5px") // Controls padding to place text in alignment with bullets
    .text(function (d) {
        return d.legendLabel;
    })
        .attr("color_value", function (d, i) {
        return colorScale(i);
    }) // Bar fill color...
    .attr("index_value", function (d, i) {
        return "index-" + i;
    })
        .attr("class", function (d, i) {
        return "pie-" + pieName + "-legendText-index-" + i;
    })
        .style("fill", "#888")
        .style("font", "normal 1em Helvetia,Arial")
        .on('mouseover', synchronizedMouseOver)
        .on("mouseout", synchronizedMouseOut);

};




// --------------------------------------------------------------------------------------------------------
//    MAIN - DOC READY
// ======================
$(document)
    .ready(function ($) {
  
  $(window).bind( 'hashchange', function(e) {

    $(".planning-section, .report-section").fadeOut(fadeOutDelay);

    // check basicAuthCredString is null to see if this is a new page load rather than hitting back on the browser.
    if (basicAuthCredString.length === 0 && $.cookie('uk2redminereports') != null){
        // returning user that was logged in
        basicAuthCredString = $.cookie('uk2redminereports');
        // hide login form, get straight to it !
        fetchTrackers();
    }
    else if (basicAuthCredString.length > 0){
        renderProjectIssuesFromUrl();
    }
  });
  
  // Since the event is only triggered when the hash changes, we need to trigger
  // the event now, to handle the hash the page may have loaded with.
  $(window).trigger( 'hashchange' );

    // devmode is a paramater that shows dev bar graph and more details on issues list
    devMode = ($.urlParam('dev') !== undefined) ? $.urlParam('dev') : 0;

    $("#loginform").submit(function (evt) {

        evt.preventDefault();
        username = $("#username").val();
        password = $("#password").val();
        basicAuthCredString = "Basic " + $.base64.encode(username + ":" + password);
        $.cookie('uk2redminereports', basicAuthCredString, { expires: 7 });

        $("#btn-login").data('original-text', $("#btn-login").val());
        $("#btn-login").val($("#btn-login").data('loading-text'));
        // if fetch trackers fails with 403 - user does not have access.
        fetchTrackers();

        // stop user from double clicking login button.
        $("#btn-login").attr("disabled", true);
        setTimeout(function(){
          $("#btn-login").attr("disabled", false);
        },3000);
    });

    $(".btn-pie-chart")
        .click(function (evt) {
        evt.preventDefault();
        if (!$(evt.target).hasClass('selected')) {
          $(".pie-chart-wrapper").hide();
          $("#" + $(evt.target).data('target')).show();
          $('.btn-pie-chart.selected').removeClass('selected');
          $(this).addClass('selected');
        }
    });

    var randomNum = Math.ceil(Math.random() * 10);
    $("#large-cartoon")
        .css('background-image', 'url(img/bunny' + randomNum + '.png)');


    $("#logout").click(function(){
        // delete the cookie
        $.removeCookie('uk2redminereports');
        window.location.href= window.location.origin + window.location.pathname;
    });

    $("#planning-link").click(function(evt){
        evt.preventDefault();
        var state = {};
        state[ "mode" ] = 'p';
        $.bbq.pushState( state );
    });
    $("#reports-link").click(function(evt){
        evt.preventDefault();
        var state = {};
        state[ "mode" ] = 'r';
        $.bbq.pushState( state );
    });
    $("#issues-comments-expand-all").click(function(evt){
        evt.preventDefault();
        $("#planning-issues-section .issues tbody tr").each(function(i,issueRow){
            expandIssueRow($(issueRow));
        });
        $(this).hide();
        $("#issues-comments-collapse-all").show();
    });
    $("#issues-comments-collapse-all").click(function(evt){
        evt.preventDefault();
        $("#planning-issues-section .open").removeClass("open");
        $("#planning-issues-section .desc, #planning-issues-section .comments").remove();
        $("#issues-comments-expand-all").show();
        $(this).hide();
    });

});


function renderProjectIssuesFromUrl(){

    var versionId = $.bbq.getState( 'vid' ) || '';
    var projectName = $.bbq.getState( 'pid' ) || '';

    // set select box to show the current project
    $("#projects").val(projectName);
    // highlight the correct version link
    // on returning user to url there are no version links so dont highlight them
    if (versionId.length > 0 && $("#versions-nav a").length > 0 ){
        var versionLink = $("#versions-nav a[data-versionid=" + versionId + "]");
        if (versionLink.length == 0) { // if not found - highlight the first one
            versionLink = $("#versions-nav a").first();
            versionId = versionLink.attr('data-versionid');
        }
        versionLink.siblings('.selected').removeClass('selected');
        versionLink.addClass('selected');
    }
    if (versionId.length > 0 && ( prevProjectName == projectName )){
        fetchIssues(projectName, versionId);
    } 
    else {
        fetchVersions(projectName, _.bind(renderVersions, this));
        prevProjectName = projectName;
    }
}
