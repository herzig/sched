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
function Process(pid) {
    this.pid = pid; // uniqued process id
    this.ip = 0; // 'instruction pointer' indexes into qunta
    this.time = 0; // virtual time consumed by this process (quantas executed)

    // the process is finished when the instruction pointer points after the last quantum.
    this.isFinished = function () { return this.ip === this.quanta.length; }

    // the list of quantas
    this.quanta = [];
    for (var i = 0; i < Math.random()*10; ++i) {
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
function FifoScheduler () {
    this.processes = [];
    this.lastpid = 0;
    this.activeProcess = null;

    this.isFinished = function () { return this.processes.length === 0; }

    // creates a new process.
    this.spawnProcess = function () {
        this.processes.push(new Process(++this.lastpid));
    };

    // fifo step
    this.step = function () {
        if (this.isFinished()) return;

        this.activeProcess = this.processes[0];
        this.activeProcess.step();
        if (this.activeProcess.isFinished()) {
            this.processes.shift();
        }
    };
}

function EdfScheduler() {
    this.clock = 0;
    this.processes = [];
    this.lastpid = 0;
    this. activeProcess = null;
    this.isFinished = function () { return this.processes.length === 0; }


    // creates a new process.
    this.spawnProcess = function () {
        var proc = new Process(++this.lastpid);
        proc.deadline = this.clock + proc.i
        this.processes.push();
    };

    // fifo step
    this.step = function () {
        if (this.isFinished()) return;

        this.activeProcess = this.processes[0];
        this.activeProcess.step();
        if (this.activeProcess.isFinished()) {
            this.processes.shift();
        }
    };
}



var TheSys =
{
    scheduler: new FifoScheduler(),

    // prints/udpates the process table
    printOverview: function () {
        $("#processes > tbody").empty(); // clear all rows

        // populate table
        var processes = this.scheduler.processes;
        for (var i = 0; i < processes.length; ++i) {
            var p = processes[i];
            var cells = wrapInTags([p.pid, p.time, p.ip, p.quanta.length], 'td');
            var cssclass = p === this.scheduler.activeProcess ? 'active' : ''

            $('#processes > tbody').append('<tr class="' + cssclass + '">' + cells + '</tr>');
        }
    },

    updateui: function () {
        this.printOverview();
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
        this.scheduler.step();
        this.updateui();
    },

    main: function () {

        this.spawnEditor = new FunctionEditor("spawnEditor", "spawnError");
        this.schedEditor = new FunctionEditor("schedEditor", "schedError");
        this.scheduler.spawnProcess = this.spawnEditor.getFunction();
        this.scheduler.step = this.schedEditor.getFunction();

    },

    spawn: function () {
        //this.scheduler.spawnProcess = this.spawnEditor.getFunction();
        //this.scheduler.step = this.schedEditor.getFunction();
        
        var numProcesses = parseInt($("#numProcesses").val());

        // spawn processes
        for (var i = 0; i < numProcesses; i++) {
            this.scheduler.spawnProcess(Math.random()*100);
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
