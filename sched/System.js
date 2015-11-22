var Schedulers = {
    'FIFO': function () {
        // the simulation requires these properties scheduler properties
        this.clock = 0; // counts calls to the schedule function
        this.processes = []; // list of processes
        this.active = null; // active process
        this.isFinished = function () { return this.processes.length === 0; }
    
        this.enqueue = function (proc) {
            this.processes.push(proc);
        }

    
        this.schedule = function() {
            ++this.clock;
            if (this.isFinished()) return;

            this.active = this.processes[0];
            this.active.step();
            if (this.active.isFinished()) { // if finished remove from queue
                this.processes.splice(this.processes.indexOf(this.active),1);
            }
        }
    },

    'RR': function () {
        // the simulation requires these properties scheduler properties
        this.clock = 0; // counts calls to the schedule function
        this.processes = []; // list of processes
        this.active = null; // active process
        this.isFinished = function () { return this.processes.length === 0; }
    
        this.currIndex = 0; // current task for RR

        this.enqueue = function (proc) {
            this.processes.push(proc);
        };
    
        this.schedule = function() {
            ++this.clock;
            if (this.isFinished()) return;
           
            // simply increment the index
            this.currIndex = ++this.currIndex % this.processes.length;

            this.active = this.processes[this.currIndex]; 
            this.active.step(); 
            if (this.active.isFinished()) { 
                this.processes.splice(this.processes.indexOf(this.active),1);
            }
        };
    },

    'FAIR': function() {
        // the simulation requires these properties scheduler properties
        this.clock = 0; // counts calls to the schedule function
        this.processes = []; // list of processes
        this.active = null; // active process
        this.isFinished = function () { return this.processes.length === 0; }
    
        this.mintime = 0;

        this.enqueue = function (proc) {
            // set new processes vruntime to the minimum runtime in the queue,
            // this makes sure that the new process is run next (or at least very sonn
            // if there are duplicate vruntimes...)
            proc.time = this.mintime;
            this.processes.push(proc);
        };

        this.schedule = function() {
            ++this.clock;
            if (this.isFinished()) return; 

            // find the process with the smallest vruntime (O(n))
            var nextprocess = this.processes[0];
            for (var i = 1; i < this.processes.length; ++i) {
                if (this.processes[i].time < nextprocess.time)
                    nextprocess = this.processes[i];
            }
            // update the schedulers vruntime
            this.minvruntime = nextprocess.time;

            // run process 
            nextprocess.step();

            this.active = nextprocess;
            if (this.active.isFinished()) { 
                this.processes.splice(this.processes.indexOf(this.active),1);
            }
        };
    }
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

// models a single quantum for the cpu.
// this is the atomic unit used to build the process.
function Quantum() {
    // execute the instruction
    this.execute = function () { };
}

// specifies a process in the simulation
// pid: the process id for the new process.
function Process(pid, numQuanta) {
    this.pid = pid; // uniqued process id
    this.ip = 0; // 'instruction pointer' indexes into qunta
    this.time = 0; // virtual time consumed by this process (quantas executed)
    this.state = 'READY'; // possible states: 'RUNNING', 'READY', 'BLOCKED'

    // the process is finished when the instruction pointer points after the last quantum.
    this.isFinished = function () { return this.ip === this.quanta.length; }

    // the list of quantas
    this.quanta = [];
    numQuanta = numQuanta < 0 ? Math.random()*10 : numQuanta;
    for (var i = 0; i < numQuanta; ++i) {
        this.quanta.push(new Quantum());
    }

    // executes the next quantum
    // each quantum is 'atomic'. preempting the process is only possible between
    // steps.
    this.step = function () {
        if (this.isFinished()) return;
        this.quanta[this.ip++].execute();
        ++this.time;
    }
}

// the scheduler handles all processes and decides execution order.
function Scheduler () {
    this.clock = 0;
    this.processes = [];
    this.lastpid = 0;
    this.activeProcess = null;

    this.isFinished = function () { return this.processes.length === 0; }

    // queues a process for execution
    this.enqueue = function (proc) { };


    this.schedule = function () {  };
}



var TheSys =
{
    scheduler: new Scheduler(),

    updateui: function () {
        // update clock
        $("#clock").val(this.scheduler.clock); 

        // update process table
        $("#processes > tbody").empty(); // clear all rows

        // populate table
        var processes = this.scheduler.processes;
        for (var i = 0; i < processes.length; ++i) {
            var p = processes[i];
            var cells = wrapInTags([p.pid, p.time, p.ip, p.quanta.length, p.deadline], 'td');
            var cssclass = p === this.scheduler.active ? 'active' : ''

            $('#processes > tbody').append('<tr class="' + cssclass + '">' + cells + '</tr>');
        }
    },

    start: function () {
        if (this.scheduler.isFinished()) {
            return;
        }

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
        this.scheduler.schedule();
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
        var deadline = parseInt($("#deadline").val());

        // spawn processes
        for (var i = 0; i < numProcesses; i++) {
            var proc = new Process(++this.lastpid, numQuanta);
            if (deadline < 0)
                proc.deadline = this.scheduler.clock + Math.floor(Math.random() * 100);
            else
                proc.deadline = this.scheduler.clock + deadline;
            this.scheduler.enqueue(proc);
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
