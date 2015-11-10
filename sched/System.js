// busy wait for the specified duration.
// ms: milliseconds to wait
function wait(ms) {
    var start = Date.now();
    while (Date.now() - start < ms) { };
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

// models a single instruction for the cpu.
function Instruction() {

    // execute the instruction
    this.execute = function () { };
}

// specifies a process in the simulation
// pid: the process id for the new process.
// numInstructions: number of instructions to generate for this process.
function Process(pid, numInstructions) {
    this.pid = pid; // uniqued process id
    this.ip = 0; // 'instruction pointer' indexes into instructions
    this.time = 0; // virtual time consumed by this process

    // the process is finished when the instruction pointer points after the last instruction.
    this.isFinished = function () { return this.ip == this.instructions.length; }

    // the list of instructions
    this.instructions = [];
    for (var i = 0; i < numInstructions; ++i) {
        this.instructions.push(new Instruction());
    }

    // executes the next instruction
    // each instruction is 'atomic'. preempting the process is only possible between
    // steps.
    this.step = function () {
        this.instructions[this.ip++].execute();
        this.time += 1;
    }
}

// the scheduler handles all processes and decides execution order.
function Scheduler () {
    this.processes = [];
    this.lastpid = 0;
    this.activeProcess = null;

    this.isFinished = function () { return this.processes.length == 0; }

    // creates a new process.
    this.spawnProcess = function (numInstructions) {
        this.processes.push(new Process(++this.lastpid, numInstructions));
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
    scheduler: new Scheduler(),


    // prints/udpates the process table
    printOverview: function () {
        $("#processes > tbody").empty(); // clear all rows

        // populate table
        var processes = this.scheduler.processes;
        for (var i = 0; i < processes.length; ++i) {
            var p = processes[i];
            var cells = wrapInTags([p.pid, p.time, p.ip, p.instructions.length], 'td');
            var cssclass = p === this.scheduler.activeProcess ? 'active' : ''

            $('#processes > tbody').append('<tr class="' + cssclass + '">' + cells + '</tr>');
        }
    },

    updateui: function (continuation) {
        this.printOverview();

        window.setTimeout(continuation, 0);
    },

    run: function (done) {
        this.scheduler.step();
        this.updateui();
        var frequency = parseInt($("#frequency").val());
        window.setTimeout(() => this.run(done), 1000 / frequency);
    },

    main: function () {
        var numProcesses = 5;


        // spawn processes
        for (var i = 0; i < numProcesses; i++) {
            this.scheduler.spawnProcess(5);
        }

        var physicalTime = Date.now();

        this.run(function () {
            physicalTime = Date.now() - physicalTime;

            console.log('Physical: ' + physicalTime);


        });
    },

    spawn: function () {
        var numProcesses = parseInt($("#numProcesses").val());
        var numInstructions = parseInt($("#numInstructions").val());

        // spawn processes
        for (var i = 0; i < numProcesses; i++) {
            this.scheduler.spawnProcess(numInstructions);
        }
    }
}

function FunctionEditor(element)  {
    this.editor = ace.edit(element);
    this.editor.setTheme("ace/theme/chrome");
    this.editor.getSession().setMode("ace/mode/javascript");

    

}
