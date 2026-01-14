-- phpMyAdmin SQL Dump
-- version 5.2.2
-- https://www.phpmyadmin.net/
--
-- Host: localhost
-- Generation Time: Jan 12, 2026 at 12:25 PM
-- Server version: 10.11.6-MariaDB
-- PHP Version: 8.2.28

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `stan`
--

-- --------------------------------------------------------

--
-- Table structure for table `event_events`
--

CREATE TABLE `event_events` (
  `id` int(11) NOT NULL,
  `name` text DEFAULT NULL,
  `description` text DEFAULT NULL,
  `workshopLeader` varchar(255) DEFAULT NULL,
  `startTime` datetime DEFAULT NULL,
  `endTime` datetime DEFAULT NULL,
  `maxParticipants` int(11) DEFAULT 0,
  `location` varchar(255) DEFAULT NULL,
  `rounds` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`rounds`)),
  `participants` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`participants`)),
  `createdAt` datetime DEFAULT current_timestamp(),
  `date` date DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `event_events`
--

INSERT INTO `event_events` (`id`, `name`, `description`, `workshopLeader`, `startTime`, `endTime`, `maxParticipants`, `location`, `rounds`, `participants`, `createdAt`, `date`) VALUES
(6, 'test', '555', 'test', '2025-12-25 00:00:00', NULL, 20, 'test', '[{\"round\":1,\"time\":\"10:55\"}]', '[]', '2025-12-23 09:19:09', NULL),
(7, 'Breien', '555', 'test890', '2025-12-25 00:00:00', NULL, 20, 'test', '[{\"round\":2,\"time\":\"06:30\"},{\"round\":3,\"time\":\"13:56\"}]', '[]', '2025-12-23 09:19:29', NULL),
(8, 'test', '555', 'test', '2025-12-28 00:00:00', NULL, 20, 'test', '[{\"round\":3,\"time\":\"07:19\"}]', '[]', '2025-12-23 09:19:47', NULL),
(9, 'Breien', 'iets', 'Stan', '2026-01-16 00:00:00', NULL, 20, 'Mijn Huis', '[{\"round\":1,\"time\":\"15:25\"}]', '[]', '2026-01-12 08:25:39', NULL);

--
-- Indexes for dumped tables
--

--
-- Indexes for table `event_events`
--
ALTER TABLE `event_events`
  ADD PRIMARY KEY (`id`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `event_events`
--
ALTER TABLE `event_events`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=23;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
