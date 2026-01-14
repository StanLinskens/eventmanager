-- phpMyAdmin SQL Dump
-- version 5.2.2
-- https://www.phpmyadmin.net/
--
-- Host: localhost
-- Generation Time: Jan 12, 2026 at 12:24 PM
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
-- Table structure for table `event_admins`
--

CREATE TABLE `event_admins` (
  `id` int(11) NOT NULL,
  `username` varchar(191) DEFAULT NULL,
  `password_hash` varchar(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `event_admins`
--

INSERT INTO `event_admins` (`id`, `username`, `password_hash`) VALUES
(1, 'admin', '$2y$10$CpUVRaJogN2LYACMkj9WP.STrUJVEud7izo7lYu2d/n/DhQMzoDCm'),
(2, 'admin1', '$2y$10$wVIMUIIbD.VWwBjyr0RZ7Ox33Ei/In1nt3Fm/vxpKiu1YXmJGrof6');

--
-- Indexes for dumped tables
--

--
-- Indexes for table `event_admins`
--
ALTER TABLE `event_admins`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `username` (`username`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `event_admins`
--
ALTER TABLE `event_admins`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
