import { useState, useEffect } from "react";
import API from "./api";
import "./App.css";

function App() {
  const [token, setToken] = useState(localStorage.getItem("token"));
  const [user, setUser] = useState(null);
  const [students, setStudents] = useState([]);

  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
  });

  const [studentData, setStudentData] = useState({
    name: "",
    age: "",
    class_name: "",
  });

  const [search, setSearch] = useState("");
  const [editId, setEditId] = useState(null);

  // =================================
  // GET PROFILE AND STUDENTS
  // =================================

  const loadDashboard = async () => {
    try {
      const profile = await API.get("/profile");
      setUser(profile.data);

      if (profile.data.role === "admin") {
        const response = await API.get("/students");
        setStudents(response.data);
      }
    } catch (error) {
      localStorage.removeItem("token");
      setToken(null);
      setUser(null);
    }
  };

  useEffect(() => {
    if (token) {
      loadDashboard();
    }
  }, [token]);

  // =================================
  // LOGIN / REGISTER
  // =================================

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      if (isLogin) {
        const response = await API.post("/login", {
          username: formData.username,
          password: formData.password,
        });

        localStorage.setItem("token", response.data.access_token);
        setToken(response.data.access_token);
      } else {
        await API.post("/users", formData);

        setMessage("Registration successful! Please login.");
        setIsLogin(true);
      }
    } catch (error) {
      setMessage(
        error.response?.data?.detail || "Something went wrong!"
      );
    } finally {
      setLoading(false);
    }
  };

  // =================================
  // STUDENT FORM
  // =================================

  const handleStudentChange = (e) => {
    setStudentData({
      ...studentData,
      [e.target.name]: e.target.value,
    });
  };

  // =================================
  // ADD / UPDATE STUDENT
  // =================================

const handleStudentSubmit = async (e) => {
  e.preventDefault();
  setMessage("");

  const name = studentData.name.trim();
  const className = studentData.class_name.trim();
  const age = Number(studentData.age);

  if (!name || !className || !studentData.age) {
    setMessage("All student fields are required!");
    return;
  }

  if (!Number.isInteger(age) || age < 1 || age > 100) {
    setMessage("Age must be a valid number between 1 and 100!");
    return;
  }

  try {
    const data = {
      name,
      age,
      class_name: className,
    };

    if (editId) {
      await API.put(`/students/${editId}`, data);
      setMessage("Student updated successfully!");
    } else {
      await API.post("/students", data);
      setMessage("Student added successfully!");
    }

    setStudentData({
      name: "",
      age: "",
      class_name: "",
    });

    setEditId(null);

    const response = await API.get("/students");
    setStudents(response.data);
  } catch (error) {
    setMessage(
      error.response?.data?.detail || "Student operation failed!"
    );
  }
};
  // =================================
  // EDIT STUDENT
  // =================================

  const editStudent = (student) => {
    setStudentData({
      name: student.name,
      age: student.age,
      class_name: student.class_name,
    });

    setEditId(student.id);
  };

  // =================================
  // DELETE STUDENT
  // =================================

  const deleteStudent = async (id) => {
    if (!window.confirm("Are you sure you want to delete this student?")) {
      return;
    }

    try {
      await API.delete(`/students/${id}`);

      setStudents((prevStudents) =>
        prevStudents.filter((student) => student.id !== id)
      );

      setMessage("Student deleted successfully!");
    } catch (error) {
      setMessage(
        error.response?.data?.detail || "Delete failed!"
      );
    }
  };

  // =================================
  // LOGOUT
  // =================================

  const logout = () => {
    localStorage.removeItem("token");
    setToken(null);
    setUser(null);
    setStudents([]);
    setMessage("");
    setSearch("");
  };

  // =================================
  // LOGIN / REGISTER PAGE
  // =================================

  if (!token) {
    return (
      <div className="auth-container">
        <div className="auth-card">

          <h1>Student Management</h1>

          <h2>{isLogin ? "Welcome Back" : "Create Account"}</h2>

          <form onSubmit={handleSubmit}>

            <input
              type="text"
              name="username"
              placeholder="Username"
              value={formData.username}
              onChange={handleChange}
              required
            />

            {!isLogin && (
              <input
                type="email"
                name="email"
                placeholder="Email"
                value={formData.email}
                onChange={handleChange}
                required
              />
            )}

            <input
              type="password"
              name="password"
              placeholder="Password"
              value={formData.password}
              onChange={handleChange}
              required
            />

            <button type="submit" disabled={loading}>
              {loading
                ? "Please wait..."
                : isLogin
                ? "Login"
                : "Register"}
            </button>

          </form>

          {message && <p>{message}</p>}

          <p>
            {isLogin
              ? "Don't have an account?"
              : "Already have an account?"}

            <span
              onClick={() => {
                setIsLogin(!isLogin);
                setMessage("");
              }}
              style={{ cursor: "pointer", marginLeft: "5px" }}
            >
              {isLogin ? "Register" : "Login"}
            </span>
          </p>

        </div>
      </div>
    );
  }

  // =================================
  // LOADING
  // =================================

  if (!user) {
    return <h2>Loading Dashboard...</h2>;
  }

  // =================================
  // NORMAL USER DASHBOARD
  // =================================

if (user.role !== "admin") {
  return (
    <div className="student-layout">

      <aside className="student-sidebar">
        <h2>🎓 Student Portal</h2>
        <p>My Dashboard</p>
        <p>My Profile</p>
        <button onClick={logout}>Logout</button>
      </aside>

      <main className="student-dashboard">

        <header>
          <div>
            <h1>Welcome, {user.username}! 👋</h1>
            <p>Welcome to your student portal.</p>
          </div>
          <span className="student-badge">Student</span>
        </header>

        <h2>My Profile</h2>

        <div className="profile-card">

          <div className="profile-avatar">
            {user.username?.charAt(0).toUpperCase()}
          </div>

          <h2>{user.username}</h2>
          <p>Student Account</p>

          <div className="profile-details">

            <div>
              <span>Username</span>
              <strong>{user.username}</strong>
            </div>

            <div>
              <span>Email Address</span>
              <strong>{user.email}</strong>
            </div>

            <div>
              <span>Account Role</span>
              <strong>Student</strong>
            </div>

            <div>
              <span>Account Status</span>
              <strong>Active</strong>
            </div>

          </div>

        </div>

        <div className="student-notice">
          <h3>📢 Information</h3>
          <p>
            Your account is currently in student mode.
            You can view your profile, but only administrators
            can manage student records.
          </p>
        </div>

      </main>
    </div>
  );
}
  // =================================
  // SEARCH FILTER
  // =================================

  const filteredStudents = students.filter(
    (student) =>
      student.name.toLowerCase().includes(search.toLowerCase()) ||
      student.class_name.toLowerCase().includes(search.toLowerCase())
  );

  // =================================
  // ADMIN DASHBOARD
  // =================================

  return (
    <div className="dashboard-layout">

      {/* SIDEBAR */}
      <aside className="sidebar">
        <h2>🎓 SMS</h2>
        <p>Dashboard</p>
        <p>Students</p>
        <p>Admin Panel</p>
      </aside>

      {/* MAIN CONTENT */}
      <main className="dashboard">

        <header>
          <h1>Admin Dashboard</h1>

          <div>
            <span>Welcome, {user.username}</span>
            <button onClick={logout}>Logout</button>
          </div>
        </header>

        <h2>Student Management</h2>

        {/* SEARCH */}
        <input
          type="text"
          placeholder="Search by name or class..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        {/* STATISTICS */}
        <div className="stats-container">

          <div className="stat-card">
            <h3>Total Students</h3>
            <h1>{students.length}</h1>
          </div>

          <div className="stat-card">
            <h3>Admin</h3>
            <h1>1</h1>
          </div>

          <div className="stat-card">
            <h3>System Status</h3>
            <h1>Active</h1>
          </div>

        </div>

        {message && <p>{message}</p>}

        {/* ADD / UPDATE FORM */}
        <form onSubmit={handleStudentSubmit}>

          <h3>{editId ? "Update Student" : "Add New Student"}</h3>

          <input
            type="text"
            name="name"
            placeholder="Student Name"
            value={studentData.name}
            onChange={handleStudentChange}
            required
          />

          <input
            type="number"
            name="age"
            placeholder="Age"
            value={studentData.age}
            onChange={handleStudentChange}
            required
            min="1"
          />

          <input
            type="text"
            name="class_name"
            placeholder="Class"
            value={studentData.class_name}
            onChange={handleStudentChange}
            required
          />

          <button type="submit">
            {editId ? "Update Student" : "Add Student"}
          </button>

          {editId && (
            <button
              type="button"
              onClick={() => {
                setEditId(null);
                setStudentData({
                  name: "",
                  age: "",
                  class_name: "",
                });
              }}
            >
              Cancel
            </button>
          )}

        </form>

        {/* STUDENT TABLE */}
        <h3>All Students</h3>

        <table border="1" cellPadding="10">

          <thead>
            <tr>
              <th>ID</th>
              <th>Name</th>
              <th>Age</th>
              <th>Class</th>
              <th>Actions</th>
            </tr>
          </thead>

          <tbody>
            {filteredStudents.length > 0 ? (
              filteredStudents.map((student) => (
                <tr key={student.id}>
                  <td>{student.id}</td>
                  <td>{student.name}</td>
                  <td>{student.age}</td>
                  <td>{student.class_name}</td>

                  <td>
                    <button onClick={() => editStudent(student)}>
                      Edit
                    </button>

                    <button onClick={() => deleteStudent(student.id)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="5">No students found.</td>
              </tr>
            )}
          </tbody>

        </table>

      </main>
    </div>
  );
}

export default App;