<script>
document.addEventListener('DOMContentLoaded', function() {
    // Select DOM elements
    const addButton = document.getElementById('add-task-btn');
    const taskInput = document.getElementById('task-input');
    const taskList = document.getElementById('task-list');

    // Load tasks from Local Storage when page loads
    loadTasks();

    // Function to load tasks from Local Storage
    function loadTasks() {
        const storedTasks = JSON.parse(localStorage.getItem('tasks') || '[]');
        storedTasks.forEach(taskText => {
            createTaskElement(taskText, false);
        });
    }

    // Function to create task element
    function createTaskElement(taskText, saveToStorage = true) {
        const taskItem = document.createElement('li');
        taskItem.classList.add('task-item');
        
        const taskTextSpan = document.createElement('span');
        taskTextSpan.textContent = taskText;
        taskItem.appendChild(taskTextSpan);

        const removeButton = document.createElement('button');
        removeButton.textContent = 'Remove';
        removeButton.className = 'remove-btn btn-danger';
        
        removeButton.onclick = function() {
            taskList.removeChild(taskItem);
            updateLocalStorage();
        };

        taskItem.appendChild(removeButton);
        taskList.appendChild(taskItem);

        if (saveToStorage) {
            updateLocalStorage();
        }
    }

    // Function to update Local Storage with current tasks
    function updateLocalStorage() {
        const tasks = [];
        document.querySelectorAll('#task-list li span').forEach(taskElement => {
            tasks.push(taskElement.textContent);
        });
        localStorage.setItem('tasks', JSON.stringify(tasks));
    }

    // Function to show a random motivational quote
    function showRandomQuote() {
        const quotes = [
            "Stay positive, work hard, make it happen.",
            "Success is the sum of small efforts repeated daily.",
            "Don't watch the clock; do what it does. Keep going.",
            "Small steps every day lead to big results.",
            "Your only limit is your mind."
        ];
        const randomIndex = Math.floor(Math.random() * quotes.length);
        alert(quotes[randomIndex]);
    }

    // Function to add a new task
    function addTask() {
        const taskText = taskInput.value.trim();
        if (taskText === '') {
            alert('Please enter a task!');
            return;
        }
        createTaskElement(taskText);
        taskInput.value = '';
        showRandomQuote(); // Display random quote after adding a task
    }

    // Event listener for add button
    addButton.addEventListener('click', addTask);

    // Event listener for Enter key in input field
    taskInput.addEventListener('keypress', function(event) {
        if (event.key === 'Enter') {
            addTask();
        }
    });
});
</script>
