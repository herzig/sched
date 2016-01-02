var Schedulers = {
    'FIFO': function () {
        this.prototype = new BaseScheduler();
        BaseScheduler.call(this);

        this.queue = [];
        
        this.schedule = function() {
            if (this.queue.length === 0) return null;
            
            return this.queue[0];
        }

        this.enqueue = function(proc) {
			if (this.queue.length == 0) {
				proc.state = 'RUN';
				this.running = proc;
			}
            this.queue.push(proc)
        }

        this.dequeue = function(proc) {
            var idx = this.queue.indexOf(proc);
            if (idx > -1) 
                this.queue.splice(idx,1);
        }
    },

    'RR': function () {
        this.prototype = new BaseScheduler();
        BaseScheduler.call(this);
       
        this.queue = [];

        this.schedule = function() {
            if (this.queue.length === 0) return null;

            var proc = this.queue[0];

            this.queue.shift();
            this.queue.push(proc);

            return proc;
        };

        this.enqueue = function(proc) {
			if (this.queue.length == 0) {
				proc.state = 'RUN';
				this.running = proc;
			}
            this.queue.unshift(proc)
        }

        this.dequeue = function(proc) {
            var idx = this.queue.indexOf(proc);
            if (idx > -1) 
                this.queue.splice(idx,1);
        }
    },

    'FAIR': function() {
        this.prototype = new BaseScheduler();
        BaseScheduler.call(this);

        this.queue = []; // in CFS: an RB-Tree

        // minmal runtime from all procs, monotonically increasing
        // we set in on every newly spawned process (set min_vruntime in CFS')
        this.minvtime = 0;

        this.schedule = function() {
            if (this.queue.length === 0) return;

            // find the process with the smallest time (linear search O(n))
	    	// in CFS this is done in O(1) on the time-ordered RB-Tree
            var next;
            if (this.running == null || this.running.state == 'BLOCKED')
                next = this.queue[0];
            else
                next = this.running

            for (var i = 0; i < this.queue.length; ++i) {
                if (this.queue[i].vtime < next.vtime)
                    next = this.queue[i];
            }
            // update the schedulers mintime
            this.minvtime = ++next.vtime;

            return next;
        };

        this.enqueue = function(proc) {
			if (this.queue.length === 0) {
				proc.state = 'RUN';
				this.running = proc;
			}

			this.queue.push(proc);

            // set new processes vruntime to the minimum runtime in the queue,
            // this makes sure that the new process is run next (or at least very soon
            // if there are duplicate times...)
            proc.vtime = this.minvtime-1;
        }

        this.dequeue = function(proc) {
            var idx = this.queue.indexOf(proc);
            if (idx > -1) 
                this.queue.splice(idx,1);
        }
    }
}

function BaseScheduler() {
    this.clock = 0; // elapsed total time since birth

    this.all = []; // list of all processes

    this.running = null; // the running process
    this.lastpid = 0; // last assigend process id, monotonically increasing
    
	// move simulation forward by one step
	// handles process state changes and runs the selected scheduler strategy
    this.step = function() {
        ++this.clock;

        for (var i = 0; i < this.all.length; ++i) {
            var proc = this.all[i];

            var prevState = proc.state;
            proc.updateState();

			// handle all state changes
            if (proc.state == 'DONE')
                this.dequeue(proc);
                
            if (prevState == 'RUN' && proc.state == 'BLOCKED')
                this.dequeue(proc);

            if (proc.state == 'READY' && prevState != 'READY' && prevState != 'RUN')
                this.enqueue(proc);
        }

        this.running = this.schedule();
        if (this.running != null)
            this.running.run();
    }

	// spawns a new  task on this scheduler
	// numQuanta: task duration, <0 for infinity
	// cpuutil: cpu utilisation [0..1], 
	//          the inverse probability that the task enters blocked state after each step.
    this.spawn = function(numQuanta, cpuutil) {
        var proc = new Process(++this.lastpid, numQuanta, 'READY', cpuutil);
        for (var i = 0; i < this.clock; ++i)
            proc.history.push('');

        this.all.push(proc);
        this.enqueue(proc);
        return proc;
    }

    // called when a process becomes ready to run
    this.enqueue = function(proc) { 
        throw 'enqueue() not implemented'
    }

    // called when a running tasks enters the BLOCKED or DONE state
    this.dequeue = function(proc) { 
        throw 'dequeue() not implemented'
    }

    // the main scheduler method, must return the selected running task.
    this.schedule = function() { 
        throw 'schedule() not implemented' 
    } 
}


// a single process/task in the simulation
// pid: the process id for the new process.
// quanta: duration of tasks, <0 for infinity
// state: task state a creation time
// cpuutil: cpu utilisation of the task
function Process(pid, quanta, state, cpuutil) {
    this.pid = pid; // unique process id
    this.time = 0; // virtual time consumed by this process (quantas executed)
    this.quanta = quanta; // number of quanta in this process (<0 means the process never stops).
    this.state = state; // possible states: 'READY', 'BLOCKED', 'DONE', 'RUN'
    this.cpuutil = cpuutil;

    this.history = [];

    // the process is finished when the instruction pointer points after the last quantum.
    this.isFinished = function () { return this.time >= this.quanta.length; }

    // executes the next quantum
    // each quantum is 'atomic'. preempting the process is only possible between
    // steps.
    this.run = function () {
        this.state = 'RUN';
        ++this.time;
    }

    // handle process state changes
    this.updateState = function() {
        this.history.push(this.state);

        if (this.state === 'DONE') 
            return;

        if (this.time >= this.quanta) {
            this.state = 'DONE';
            return;
        }

        if (this.state == 'BLOCKED' && Math.random() < this.cpuutil) {
            this.state = 'READY';
            return;
        }

        if (this.state == 'RUN') {
            if (Math.random() > this.cpuutil) {
                this.state = 'BLOCKED';
            }
            else {
                this.state = 'READY'
            }
            return;
        }
                  
    }
}

// simulation environment GUI and event handling
var TheSys =
{
    scheduler: null, // the current scheduler

    updateui: function () {
        // update clock
        $("#clock").val(this.scheduler.clock); 

        // update process table
        $("#processes > tbody").empty(); // clear all rows

        // populate table
        var procs = this.scheduler.all;
        for (var i = 0; i < procs.length; ++i) {
            var p = procs[i];
            var cells = wrapInTags([p.pid, p.time, p.quanta, p.state, p.cpuutil], 'td');

            var cssclass = p === this.scheduler.running ? 'active' : ''

            $('#processes > tbody').append('<tr class="' + cssclass + '">' + cells + '</tr>');
        }

		// populate history table
        $("#history > tbody").empty();
        for (var i = 0; i < procs.length; ++i) {
            var p = procs[i];
            var cells = buildHistoryTags(p.history, 'td');

            var cssclass = p === this.scheduler.running ? 'active' : ''

            $('#history').append('<tr class="' + cssclass + '">' + cells + '</tr>');
        }

		// auto scroll to end of timeline
        $("#historydiv").scrollLeft($("#historydiv")[0].scrollWidth);
    },

    start: function () {
        var speed = parseInt($("#speed").val());
        $("#bu_pause")[0].disabled = false;
        $("#bu_start")[0].disabled = true;
        this.interval = window.setInterval(() => this.step(), 1000 / speed);
    },

    pause: function() {
       $("#bu_pause")[0].disabled = true;
       $("#bu_start")[0].disabled = false;
       window.clearInterval(this.interval);
       this.updateui();
    },

    step: function () {
        this.scheduler.step();
        this.updateui();
    },

    changestrategy: function() {
        var strategy = $("#strategy")[0].value;
        this.scheduler = new Schedulers[strategy];

    },

    main: function () {
        this.changestrategy();
    },

    lastpid: 0,
    spawn: function () {
        
        var numProcesses = parseInt($("#numProcesses").val());
        var numQuanta = parseInt($("#numQuanta").val());
        var cpuutil = parseFloat($("#cpuutil").val());
        if (isNaN(numQuanta) || numQuanta < 1)
            numQuanta = Number.POSITIVE_INFINITY;

        // spawn processes
        for (var i = 0; i < numProcesses; i++) {
            this.scheduler.spawn(numQuanta, cpuutil);
        }

        this.updateui();
    }
}




// wraps the specified values in the specifed markup tags and returns the resulting string
// values: array of values
// element: markup element string ('td')
function wrapInTags(values, element) {
    var result = '';
    for (var i = 0; i < values.length; ++i) {
        result += '<' + element + ' class="'+values[i]+'">' + values[i] + '</' + element + '>';
    }
    return result;
}

// create empty [element]-tags with the values set as class
function buildHistoryTags(values, element) {
     var result = '';
    for (var i = 0; i < values.length; ++i) {
        result += '<' + element + ' class="'+values[i]+'">&nbsp;&nbsp;</' + element + '>';
    }
    return result;   
}
