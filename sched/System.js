var Schedulers = {
    'FIFO': function () {
        this.prototype = new BaseScheduler();
        BaseScheduler.call(this);
        
        this.schedule = function()
        {
            if (this.ready.length === 0) return;
            this.run(this.ready[0]);
        }
    },

    'RR': function () {
        this.prototype = new BaseScheduler();
        BaseScheduler.call(this);
       
        this.currIndex = 0; // index into ready list.

        this.schedule = function() {
           if (this.ready.length === 0) return;

            // simply increment the index
            this.currIndex = ++this.currIndex % this.ready.length;

            this.run(this.ready[this.currIndex]);
        };
    },

    'FAIR': function() {
        this.prototype = new BaseScheduler();
        BaseScheduler.call(this);

        // minmal runtime from all procs, monotonically increasing because we set it
        // on every newly spawned process (set min_vruntime in CFS')
        this.mintime = 0;

        this.enqueue = function(proc) {
            this.prototype.enqueue.call(this, proc);

            // set new processes vruntime to the minimum runtime in the queue,
            // this makes sure that the new process is run next (or at least very soon
            // if there are duplicate times...)
            proc.time = this.mintime;
        }

        this.schedule = function() {
            if (this.ready.length === 0) return;

            // find the process with the smallest time (O(n))
            if (this.running == null || this.running.state == 'WAIT')
                nextprocess = this.ready[0];
            else
                nextprocess = this.running

            for (var i = 0; i < this.ready.length; ++i) {
                if (this.ready[i].time < nextprocess.time)
                    nextprocess = this.ready[i];
            }
            // update the schedulers mintime
            this.mintime = nextprocess.time;

            // run process 
            this.run(nextprocess);
        };
    }
}

function BaseScheduler() {
    this.clock = 0; // elapsed total time since birth

    this.all = []; // list of all processes
    this.ready = []; // keeps track of ready processes
    this.waiting = []; // keeps track of waiting processes

    this.running = null; // the running process
    this.lastpid = 0;
    
    this.step = function() {
        this.pollStates();
        ++this.clock;

        this.schedule()
    }

    this.spawn = function(numQuanta, cpuutil) {
        var proc = new Process(++this.lastpid, numQuanta, 'READY', cpuutil);
        this.all.push(proc);
        this.enqueue(proc);
        return proc;
    }

    this.enqueue = function(proc) {
        if (proc.state != 'READY') throw 'Not allowed when not in READY state';

        // remove from waiting queue
        if ((i = this.waiting.indexOf(proc)) >= 0) {
            this.waiting.splice(i,1);
        }

        if (this.ready.indexOf(proc) < 0) {
            this.ready.push(proc);
        }
    }

    this.remove = function(proc) {
        if ((idx = this.ready.indexOf(proc)) >= 0)
            this.ready.splice(idx,1);
        if ((idx = this.waiting.indexOf(proc)) >= 0)
            this.waiting.splice(idx,1);
    }

    // runs the specified process for one quantum and keeps track of its state
    this.run = function(proc) {
        if (proc.state != 'READY') throw 'Not allowed when not in READY state';

        this.running = proc;
        proc.run();

        if (proc.state === 'DONE') { // remove from proc list
            this.remove(proc);
        }
    }

    // polls all sleepers and checks if they are still sleeping or enqueue for scheduling.
    this.pollStates = function () {

        for (var i = 0; i < this.all.length; ++i) {
            var proc = this.all[i];
            var before = proc.state;

            proc.updateState();
            if (before === proc.state) continue;

            if (proc.state === 'WAIT') {
                if (this.waiting.indexOf(proc) < 0)
                    this.waiting.push(proc);

                var idx = this.ready.indexOf(proc);
                if (idx >= 0)
                    this.ready.splice(idx,1);    
            }
            else if (proc.state === 'READY') {
                this.enqueue(proc);
            }
        }
    }

    // overwrite this in your scheduler implementation
    this.schedule = function() { throw 'schedule() not implemented' } 
}


// wraps the specified values in the specifed markup tags and returns the resulting string
// values: array of values
// element: markup element string ('td')
function wrapInTags(values, element) {
    var result = '';
    for (var i = 0; i < values.length; ++i) {
        result += '<' + element + '>' + values[i] + '</' + element + '>';
    }
    return result;
}

// specifies a process in the simulation
// pid: the process id for the new process.
function Process(pid, quanta, state, cpuutil) {
    this.pid = pid; // unique process id
    this.time = 0; // virtual time consumed by this process (quantas executed)
    this.quanta = quanta; // number of quanta in this process (<0 means the process never stops).
    this.state = state; // possible states: 'READY', 'BLOCKED', 'DONE'
    this.cpuutil = cpuutil;

    // the process is finished when the instruction pointer points after the last quantum.
    this.isFinished = function () { return this.time >= this.quanta.length; }

    // executes the next quantum
    // each quantum is 'atomic'. preempting the process is only possible between
    // steps.
    this.run = function () {

        if (this.time >= this.quanta)
            this.state = 'DONE';
           
        ++this.time;
    }

    // update process state based on the probability set in cpuutil
    this.updateState = function() {
        if (state === 'DONE') return;
        
        if (Math.random() > this.cpuutil)
            this.state = 'WAIT';
        else if (this.state === 'WAIT')
            this.state = 'READY';
          
    }
}

var TheSys =
{
    scheduler: null,

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
        this.spawnEditor = new FunctionEditor("spawnEditor", "spawnError");
        this.schedEditor = new FunctionEditor("schedEditor", "schedError");

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

function FunctionEditor(element, errorElement)  {
    this.editor = ace.edit(element);
    this.editor.setTheme("ace/theme/chrome");
    this.editor.getSession().setMode("ace/mode/javascript");
    this.errorElement = ($("#"+errorElement));

    this.lastRunning = null;

    this.getFunction = function() {
        var source = this.editor.getValue();

        try {
            var f = new Function(source);
            this.lastRunning = f;
            this.errorElement.text('Ok!')
        } 
        catch (ex) {
            this.errorElement.text(ex);
        }

        return this.lastRunning;
    }

}
